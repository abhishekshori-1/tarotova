export type SaveState = "saved" | "saving" | "failed";

export interface SaveQueue<T> {
  /** Record the latest desired value; a save starts now or right after the in-flight one. */
  push(value: T): void;
  /** Resend the last failed value. */
  retry(): void;
  /** Resolves once nothing is pending or in flight; rejects if the last save failed. */
  flush(): Promise<void>;
  readonly state: SaveState;
}

/**
 * Serializes saves so the UI can accept taps immediately (docs/PLAN-EXTENDED.md
 * section 8): at most one request is in flight, and queued edits collapse to
 * the latest desired value. A failure stops the loop instead of hammering
 * the server; the caller shows the unsaved state and can retry.
 */
export function createSaveQueue<T>(options: {
  save: (value: T) => Promise<void>;
  onError?: (error: unknown, value: T) => void;
  onStateChange?: (state: SaveState) => void;
}): SaveQueue<T> {
  let desired: { value: T } | null = null;
  let failed: { value: T; error: unknown } | null = null;
  let inFlight = false;
  let state: SaveState = "saved";
  const waiters: { resolve: () => void; reject: (e: unknown) => void }[] = [];

  function setState(next: SaveState) {
    if (state === next) return;
    state = next;
    options.onStateChange?.(next);
  }

  function settle() {
    const pending = waiters.splice(0);
    for (const w of pending) {
      if (failed) w.reject(failed.error);
      else w.resolve();
    }
  }

  async function run() {
    if (inFlight) return;
    inFlight = true;
    setState("saving");
    while (desired) {
      const { value } = desired;
      desired = null;
      try {
        await options.save(value);
      } catch (error) {
        failed = { value, error };
        options.onError?.(error, value);
        break;
      }
    }
    inFlight = false;
    setState(failed ? "failed" : "saved");
    settle();
  }

  return {
    push(value) {
      desired = { value };
      failed = null;
      void run();
    },
    retry() {
      if (!failed) return;
      desired = { value: failed.value };
      failed = null;
      void run();
    },
    flush() {
      if (!inFlight && !desired) return failed ? Promise.reject(failed.error) : Promise.resolve();
      return new Promise((resolve, reject) => waiters.push({ resolve, reject }));
    },
    get state() {
      return state;
    },
  };
}
