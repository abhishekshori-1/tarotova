import { afterEach, describe, expect, it, vi } from "vitest";
import { canShowCardReading, watchInterpretation } from "./interpretationProgress";
import type { InterpretationView } from "@/server/generation/types";

afterEach(() => vi.useRealTimers());

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((a, b) => { resolve = a; reject = b; });
  return { promise, resolve, reject };
}

describe("triage progress during an open generation POST", () => {
  it("reveals ordinary cards before POST completion and keeps them after answer failure", async () => {
    vi.useFakeTimers();
    const post = deferred<InterpretationView>();
    const request = vi.fn(() => post.promise);
    const onUpdate = vi.fn();
    const read = vi.fn().mockResolvedValue({ status: "pending", classifiedCategory: "none" });
    const done = watchInterpretation({ initial: { status: "idle" }, request, read, onUpdate, signal: new AbortController().signal });
    expect(canShowCardReading(onUpdate.mock.calls[0][0])).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(onUpdate).toHaveBeenLastCalledWith({ status: "pending", classifiedCategory: "none" });
    expect(canShowCardReading(onUpdate.mock.calls.at(-1)![0])).toBe(true);
    post.resolve({ status: "failed", reason: "provider_timeout", retryable: true });
    await done;
    expect(onUpdate).toHaveBeenLastCalledWith({ status: "failed", reason: "provider_timeout", retryable: true, classifiedCategory: "none" });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("keeps a previously classified reading visible during retry and a network failure", async () => {
    vi.useFakeTimers();
    const onUpdate = vi.fn();
    const done = watchInterpretation({
      initial: { status: "failed", reason: "timeout", retryable: true, classifiedCategory: "stressful" },
      request: async () => { throw new Error("network"); },
      read: async () => { throw new Error("network"); },
      onUpdate, signal: new AbortController().signal,
    });
    expect(canShowCardReading(onUpdate.mock.calls[0][0])).toBe(true);
    await vi.advanceTimersByTimeAsync(2000);
    await done;
    expect(onUpdate.mock.calls.at(-1)![0]).toMatchObject({ status: "failed", classifiedCategory: "stressful" });
  });

  it("ignores late progress after a support response and cancels polling", async () => {
    vi.useFakeTimers();
    const post = deferred<InterpretationView>();
    const read = deferred<InterpretationView>();
    const onUpdate = vi.fn();
    const done = watchInterpretation({ initial: { status: "idle" }, request: () => post.promise, read: () => read.promise, onUpdate, signal: new AbortController().signal });
    await vi.advanceTimersByTimeAsync(2000);
    post.resolve({ status: "refused", category: "crisis", response: { heading: "Support", body: [], resources: [] } });
    await done;
    read.resolve({ status: "pending", classifiedCategory: "none" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(onUpdate.mock.calls.at(-1)![0].status).toBe("refused");
    expect(canShowCardReading(onUpdate.mock.calls.at(-1)![0])).toBe(false);
  });

  it("does not cancel a retry when the first poll still sees the old failed row", async () => {
    vi.useFakeTimers();
    const initial: InterpretationView = { status: "failed", reason: "timeout", retryable: true, classifiedCategory: "none" };
    const post = deferred<InterpretationView>();
    const onUpdate = vi.fn();
    const done = watchInterpretation({ initial, request: () => post.promise, read: async () => initial, onUpdate, signal: new AbortController().signal });
    await vi.advanceTimersByTimeAsync(2000);
    expect(onUpdate).toHaveBeenLastCalledWith({ status: "pending", classifiedCategory: "none" });
    post.resolve({ status: "failed", reason: "final_failure", retryable: false, classifiedCategory: "none" });
    await done;
    expect(onUpdate.mock.calls.at(-1)![0]).toMatchObject({ status: "failed", reason: "final_failure" });
  });

  it("cancels work and updates on unmount", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const post = deferred<InterpretationView>();
    const read = vi.fn();
    const onUpdate = vi.fn();
    const done = watchInterpretation({ initial: { status: "idle" }, request: () => post.promise, read, onUpdate, signal: controller.signal });
    controller.abort();
    await done;
    post.resolve({ status: "failed", reason: "timeout", retryable: true });
    await vi.advanceTimersByTimeAsync(5000);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(read).not.toHaveBeenCalled();
  });
});
