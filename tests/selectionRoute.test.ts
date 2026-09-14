import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PUT } from "@/app/api/readings/[id]/selection/route";
import { db } from "@/server/db/client";
import { browserSessions, rateLimitBuckets } from "@/server/db/schema";
import { randomId } from "@/server/ids";
import { createReading } from "@/server/readingService";
import { resolveSession } from "@/server/session";
import { verifyTurnstile } from "@/server/turnstile";

vi.mock("@/server/db/migrate", () => ({ ensureMigrated: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/server/session", () => ({ resolveSession: vi.fn() }));
vi.mock("@/server/turnstile", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/server/turnstile")>()), verifyTurnstile: vi.fn() }));

const DAY = 24 * 60 * 60 * 1000;

async function createSession(verified = false): Promise<string> {
  const id = randomId();
  const t = Date.now();
  await db.insert(browserSessions).values({ id, tokenHash: randomId(), createdAt: t, expiresAt: t + 30 * DAY, verifiedUntil: verified ? t + 30 * DAY : null });
  return id;
}

function put(id: string, body: unknown) {
  return PUT(
    new Request(`https://tarotova.example/api/readings/${id}/selection`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "203.0.113.9" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(async () => {
  await db.delete(rateLimitBuckets);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("PUT /api/readings/[id]/selection — bot check on the email-free reveal", () => {
  it("saves a draft selection without any bot check", async () => {
    const session = await createSession();
    vi.mocked(resolveSession).mockResolvedValue({ id: session, isNew: false });
    const draft = await createReading(session);
    const response = await put(draft.id, { revision: draft.revision, slots: [1, 2] });
    expect(response.status).toBe(200);
    expect(verifyTurnstile).not.toHaveBeenCalled();
  });

  it("rejects a guest lock whose token fails, without locking the draw", async () => {
    vi.mocked(verifyTurnstile).mockResolvedValue(false);
    const session = await createSession();
    vi.mocked(resolveSession).mockResolvedValue({ id: session, isNew: false });
    const draft = await createReading(session);
    const response = await put(draft.id, { revision: draft.revision, slots: [1, 2, 3], lock: true });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "bot_check_failed" });
    expect(verifyTurnstile).toHaveBeenCalledWith(undefined, "203.0.113.9");

    const retry = await put(draft.id, { revision: draft.revision, slots: [1, 2, 3], lock: true, turnstileToken: "fresh" });
    expect(retry.status).toBe(400); // still mocked false; the revision was not consumed
    expect(verifyTurnstile).toHaveBeenLastCalledWith("fresh", "203.0.113.9");
  });

  it("locks a guest draw when the token passes", async () => {
    vi.mocked(verifyTurnstile).mockResolvedValue(true);
    const session = await createSession();
    vi.mocked(resolveSession).mockResolvedValue({ id: session, isNew: false });
    const draft = await createReading(session);
    const response = await put(draft.id, { revision: draft.revision, slots: [1, 2, 3], lock: true, turnstileToken: "ok" });
    expect(response.status).toBe(200);
    expect((await response.json()).entitlement).toBe("granted");
  });

  it("skips the check for a verified session, which already passed it", async () => {
    const session = await createSession(true);
    vi.mocked(resolveSession).mockResolvedValue({ id: session, isNew: false });
    const draft = await createReading(session);
    const response = await put(draft.id, { revision: draft.revision, slots: [1, 2, 3], lock: true });
    expect(response.status).toBe(200);
    expect(verifyTurnstile).not.toHaveBeenCalled();
  });

  it("fails closed when production has no Turnstile secret", async () => {
    const { BotCheckConfigurationError } = await vi.importActual<typeof import("@/server/turnstile")>("@/server/turnstile");
    vi.mocked(verifyTurnstile).mockRejectedValue(new BotCheckConfigurationError("TURNSTILE_SECRET_KEY is required in production."));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const session = await createSession();
    vi.mocked(resolveSession).mockResolvedValue({ id: session, isNew: false });
    const draft = await createReading(session);
    const response = await put(draft.id, { revision: draft.revision, slots: [1, 2, 3], lock: true });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "bot_check_not_configured" });
  });
});
