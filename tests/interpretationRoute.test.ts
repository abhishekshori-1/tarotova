import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/readings/[id]/interpretation/route";
import { db } from "@/server/db/client";
import { browserSessions, rateLimitBuckets } from "@/server/db/schema";
import { randomId } from "@/server/ids";
import { createReading, updateSelection } from "@/server/readingService";
import { ensureMigrated } from "@/server/db/migrate";
import { StubProvider } from "@/server/generation/stub";
import { GENERATION_REQUEST_DEADLINE_MS } from "@/server/generation/config";
import { resolveSession } from "@/server/session";

vi.mock("@/server/db/migrate", () => ({ ensureMigrated: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/server/session", () => ({ resolveSession: vi.fn() }));

async function createSession(): Promise<string> {
  const id = randomId();
  const t = Date.now();
  await db.insert(browserSessions).values({ id, tokenHash: randomId(), createdAt: t, expiresAt: t + 60_000 });
  return id;
}

function post(id: string) {
  return POST(new Request(`https://tarotova.example/api/readings/${id}/interpretation`, { method: "POST" }), { params: Promise.resolve({ id }) });
}

beforeEach(async () => {
  await db.delete(rateLimitBuckets);
  vi.stubEnv("GENERATION_ENABLED", "true");
  vi.stubEnv("GENERATION_PROVIDER", "stub");
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/readings/[id]/interpretation", () => {
  it("returns the stored answer for the owner, privately, with a request id", async () => {
    const session = await createSession();
    vi.mocked(resolveSession).mockResolvedValue({ id: session, isNew: false });
    const draft = await createReading(session, "work", "What should I consider before changing jobs?");
    await updateSelection(draft.id, session, draft.revision, [0, 1, 2], true, undefined);

    const response = await post(draft.id);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Request-Id")).toBeTruthy();
    const body = await response.json();
    expect(body.status).toBe("succeeded");
    expect(body.answer.cards).toHaveLength(3);
  });

  it("is a 404 for a different browser and a 403 for an unentitled owner", async () => {
    const owner = await createSession();
    const draft = await createReading(owner, "work", "A question");
    await updateSelection(draft.id, owner, draft.revision, [0, 1, 2], true, undefined);

    vi.mocked(resolveSession).mockResolvedValue({ id: await createSession(), isNew: false });
    expect((await post(draft.id)).status).toBe(404);

    vi.mocked(resolveSession).mockResolvedValue({ id: owner, isNew: false });
    const second = await createReading(owner, "work", "Another question");
    await updateSelection(second.id, owner, second.revision, [3, 4, 5], true, undefined);
    const response = await post(second.id);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "verification_required" });
  });

  it("starts the deadline before migration and session work", async () => {
    const session = await createSession();
    const draft = await createReading(session, "work", "A question");
    await updateSelection(draft.id, session, draft.revision, [0, 1, 2], true, undefined);
    let now = Date.now();
    const startedAt = now;
    vi.spyOn(Date, "now").mockImplementation(() => now);
    vi.mocked(ensureMigrated).mockImplementationOnce(async () => { now += 10_000; });
    vi.mocked(resolveSession).mockImplementationOnce(async () => { now += 5000; return { id: session, isNew: false }; });
    const spy = vi.spyOn(StubProvider.prototype, "interpret");
    expect((await post(draft.id)).status).toBe(200);
    expect(spy).toHaveBeenCalledWith(expect.anything(), { deadlineAt: startedAt + GENERATION_REQUEST_DEADLINE_MS });
  });

  it("says disabled when the flag is off", async () => {
    vi.stubEnv("GENERATION_ENABLED", "false");
    const session = await createSession();
    vi.mocked(resolveSession).mockResolvedValue({ id: session, isNew: false });
    const draft = await createReading(session, "work", "A question");
    await updateSelection(draft.id, session, draft.revision, [0, 1, 2], true, undefined);
    const response = await post(draft.id);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "disabled" });
  });
});
