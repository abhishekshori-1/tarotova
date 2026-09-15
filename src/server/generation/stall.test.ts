import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AnthropicProvider } from "./anthropic";
import { DeepSeekProvider } from "./deepseek";
import { GeminiProvider } from "./gemini";
import type { InterpretationInput } from "./types";

// A request that really stalls, not a mocked rejection: the server accepts
// the connection and never answers (or answers headers and then stops), and
// each adapter must give up at its timeout and report an uncertain timeout.
// Written after a write phase in an eval run recorded 193 s.

const INPUT: InterpretationInput = { question: "q", safetyCategory: "none", focusLabel: "General", cards: [] };
let silent: Server;
let headersOnly: Server;
let silentUrl = "";
let headersUrl = "";

beforeAll(async () => {
  silent = createServer(() => {
    /* never respond */
  });
  headersOnly = createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.write('{"candidates":[{"content":{"parts":[{"text":"{'); // then nothing
  });
  await new Promise<void>((r) => silent.listen(0, "127.0.0.1", r));
  await new Promise<void>((r) => headersOnly.listen(0, "127.0.0.1", r));
  silentUrl = `http://127.0.0.1:${(silent.address() as { port: number }).port}`;
  headersUrl = `http://127.0.0.1:${(headersOnly.address() as { port: number }).port}`;
});

afterAll(() => {
  silent.closeAllConnections();
  headersOnly.closeAllConnections();
  silent.close();
  headersOnly.close();
});

const TIMEOUT = 400;

describe.each([
  ["gemini", (url: string) => new GeminiProvider("k", { answer: "m", classifier: "m" }, TIMEOUT, url)],
  ["anthropic", (url: string) => new AnthropicProvider("k", { answer: "m", classifier: "m" }, TIMEOUT, undefined, url)],
  ["deepseek", (url: string) => new DeepSeekProvider("k", { answer: "m", classifier: "m" }, TIMEOUT, url)],
])("%s adapter under a real stall", (_name, make) => {
  it("ends a call the server never answers at the timeout", async () => {
    const started = Date.now();
    const outcome = await make(silentUrl).interpret(INPUT);
    const elapsed = Date.now() - started;
    expect(outcome).toMatchObject({ ok: false, reason: "provider_timeout", retryable: true, uncertain: true });
    expect(elapsed).toBeLessThan(TIMEOUT + 1500);
  });

  it("ends a call whose body never finishes at the timeout", async () => {
    const started = Date.now();
    const outcome = await make(headersUrl).interpret(INPUT);
    const elapsed = Date.now() - started;
    expect(outcome).toMatchObject({ ok: false, reason: "provider_timeout", uncertain: true });
    expect(elapsed).toBeLessThan(TIMEOUT + 1500);
  });

  it("respects a shared deadline shorter than its own timeout", async () => {
    const started = Date.now();
    const outcome = await make(silentUrl).interpret(INPUT, { deadlineAt: Date.now() + 150 });
    expect(outcome).toMatchObject({ ok: false, reason: "provider_timeout" });
    expect(Date.now() - started).toBeLessThan(1200);
  });
});
