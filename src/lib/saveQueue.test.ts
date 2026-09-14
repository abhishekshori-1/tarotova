import { describe, expect, it, vi } from "vitest";
import { createSaveQueue } from "./saveQueue";

function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createSaveQueue", () => {
  it("keeps one request in flight and collapses queued edits to the latest value", async () => {
    const gates = [deferred(), deferred()];
    const saved: number[][] = [];
    const save = vi.fn(async (value: number[]) => {
      saved.push(value);
      await gates[saved.length - 1].promise;
    });
    const queue = createSaveQueue({ save });

    queue.push([0]);
    queue.push([0, 1]);
    queue.push([0, 1, 2]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(queue.state).toBe("saving");

    gates[0].resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(save).toHaveBeenCalledTimes(2);
    expect(saved[1]).toEqual([0, 1, 2]);

    gates[1].resolve();
    await queue.flush();
    expect(save).toHaveBeenCalledTimes(2);
    expect(queue.state).toBe("saved");
  });

  it("stops on failure, reports it, and resends the failed value on retry", async () => {
    const states: string[] = [];
    const onError = vi.fn();
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const queue = createSaveQueue<number[]>({ save, onError, onStateChange: (s) => states.push(s) });

    queue.push([3]);
    await expect(queue.flush()).rejects.toThrow("offline");
    expect(queue.state).toBe("failed");
    expect(onError).toHaveBeenCalledWith(expect.any(Error), [3]);
    expect(save).toHaveBeenCalledTimes(1);

    queue.retry();
    await queue.flush();
    expect(save).toHaveBeenLastCalledWith([3]);
    expect(queue.state).toBe("saved");
    expect(states).toEqual(["saving", "failed", "saving", "saved"]);
  });

  it("clears a failure when a newer value is pushed", async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    const queue = createSaveQueue<number[]>({ save });
    queue.push([1]);
    await expect(queue.flush()).rejects.toThrow();
    queue.push([1, 2]);
    await queue.flush();
    expect(save).toHaveBeenLastCalledWith([1, 2]);
  });

  it("resolves flush immediately when idle", async () => {
    const queue = createSaveQueue<number>({ save: async () => {} });
    await expect(queue.flush()).resolves.toBeUndefined();
  });
});
