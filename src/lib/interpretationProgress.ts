import type { InterpretationView } from "@/server/generation/types";

export function classifiedCategory(view: InterpretationView | null): "none" | "stressful" | undefined {
  return view && "classifiedCategory" in view ? view.classifiedCategory : undefined;
}

export function canShowCardReading(view: InterpretationView | null): boolean {
  return view?.status === "succeeded" || view?.status === "disabled" || view?.status === "not_applicable" || classifiedCategory(view) !== undefined;
}

/** Poll persisted progress while the generation POST is still open. */
export function watchInterpretation({ initial, request, read, onUpdate, signal, intervalMs = 2000, timeoutMs = 75_000 }: {
  initial: InterpretationView;
  request: (signal: AbortSignal) => Promise<InterpretationView>;
  read: (signal: AbortSignal) => Promise<InterpretationView>;
  onUpdate: (view: InterpretationView) => void;
  signal: AbortSignal;
  intervalMs?: number;
  timeoutMs?: number;
}): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const network = new AbortController();
    let latest: InterpretationView = { status: "pending", ...(classifiedCategory(initial) ? { classifiedCategory: classifiedCategory(initial) } : {}) };
    let done = false;
    let postFailed = false;
    let timer: ReturnType<typeof setTimeout>;

    function stop() {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(deadline);
      signal.removeEventListener("abort", stop);
      network.abort();
      resolve();
    }

    function update(view: InterpretationView) {
      if (done) return;
      // A delayed pending POST/GET must not erase triage already received.
      const category = classifiedCategory(view) ?? classifiedCategory(latest);
      latest = (view.status === "pending" || view.status === "failed" || view.status === "unavailable") && category
        ? { ...view, classifiedCategory: category }
        : view;
      onUpdate(latest);
      if (view.status !== "idle" && view.status !== "pending") stop();
    }

    function failed(reason: string) {
      update({ status: "failed", reason, retryable: true });
    }

    async function poll() {
      try {
        const view = await read(network.signal);
        // A failed POST with no row means generation never got started.
        if (postFailed && view.status === "idle") failed("request_failed");
        // During a retry, the GET may still see the previous failed row
        // before the POST claims it. Let the POST report its final failure.
        else if (view.status !== "idle" && !(initial.status === "failed" && view.status === "failed" && !postFailed)) update(view);
      } catch {
        if (postFailed && !done) failed("request_failed");
        // A transient poll error does not discard a still-running POST.
      }
      if (!done) timer = setTimeout(poll, intervalMs);
    }

    signal.addEventListener("abort", stop, { once: true });
    onUpdate(latest);
    const deadline = setTimeout(() => failed("timeout"), timeoutMs);
    timer = setTimeout(poll, intervalMs);
    void request(network.signal).then(update, () => { postFailed = true; });
  });
}
