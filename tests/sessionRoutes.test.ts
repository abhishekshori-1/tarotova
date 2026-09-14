import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as sessionGet } from "@/app/api/session/route";
import { POST as requestPost } from "@/app/api/session/verification/route";
import { POST as confirmPost } from "@/app/api/session/verification/confirm/route";
import { db } from "@/server/db/client";
import { browserSessions, rateLimitBuckets } from "@/server/db/schema";
import { randomId } from "@/server/ids";
import { consoleEmailProvider } from "@/server/email/console-provider";
import { resolveSession } from "@/server/session";
import { verifyTurnstile } from "@/server/turnstile";

vi.mock("@/server/db/migrate", () => ({ ensureMigrated: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/server/session", () => ({ resolveSession: vi.fn() }));
vi.mock("@/server/turnstile", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/server/turnstile")>(),
  verifyTurnstile: vi.fn().mockResolvedValue(true),
}));

let sessionId: string;

function post(handler: (req: Request) => Promise<Response>, path: string, body: unknown) {
  return handler(new Request(`https://tarotova.example${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}

beforeEach(async () => {
  await db.delete(rateLimitBuckets);
  sessionId = randomId();
  const t = Date.now();
  await db.insert(browserSessions).values({ id: sessionId, tokenHash: randomId(), createdAt: t, expiresAt: t + 60_000 });
  vi.mocked(resolveSession).mockResolvedValue({ id: sessionId, isNew: false });
  vi.mocked(verifyTurnstile).mockResolvedValue(true);
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("session verification over HTTP", () => {
  it("walks request → confirm → verified, exposing only a masked address", async () => {
    let res: Response = await sessionGet();
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await res.json()).verified).toBe(false);

    res = await post(requestPost, "/api/session/verification", { email: "Visitor@Example.com", turnstileToken: "t" });
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Request-Id")).toBeTruthy();
    const sent = await res.json();
    expect(sent.sendStatus).toBe("accepted");
    expect(sent.devCode).toMatch(/^\d{6}$/);
    expect(JSON.stringify(sent)).not.toContain("example.com");

    const status = await (await sessionGet()).json();
    expect(status.maskedEmail).toBe("v••••••@example.com");
    expect(status.pendingChallenge.sendStatus).toBe("accepted");

    res = await post(confirmPost, "/api/session/verification/confirm", { code: "000000" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "verification_failed", reason: "wrong_code" });

    const code = (consoleEmailProvider as unknown as { lastCodeFor(id: string): string }).lastCodeFor(sessionId);
    res = await post(confirmPost, "/api/session/verification/confirm", { code });
    expect(res.status).toBe(200);
    expect((await (await sessionGet()).json()).verified).toBe(true);
  });

  it("short-circuits on a rejected bot token without sending", async () => {
    vi.mocked(verifyTurnstile).mockResolvedValueOnce(false);
    const res = await post(requestPost, "/api/session/verification", { email: "visitor@example.com" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bot_check_failed" });
    expect((await (await sessionGet()).json()).pendingChallenge).toBeUndefined();
    expect(console.info).toHaveBeenCalledWith("[session_verification]", expect.objectContaining({ stage: "turnstile", status: 400 }));
  });

  it("rejects malformed input as a bad request", async () => {
    expect((await post(requestPost, "/api/session/verification", { email: "not-an-email" })).status).toBe(400);
    expect((await post(confirmPost, "/api/session/verification/confirm", { code: "12" })).status).toBe(400);
  });
});
