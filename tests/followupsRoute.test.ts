import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/readings/[id]/followups/route";
import { db } from "@/server/db/client";
import { browserSessions, rateLimitBuckets } from "@/server/db/schema";
import { randomId } from "@/server/ids";
import { createReading, updateSelection } from "@/server/readingService";
import { requestInterpretation } from "@/server/generation/service";
import { resolveSession } from "@/server/session";

vi.mock("@/server/db/migrate", () => ({ ensureMigrated: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/server/session", () => ({ resolveSession: vi.fn() }));

async function createSession(): Promise<string> {
  const id = randomId();
  const t = Date.now();
  await db.insert(browserSessions).values({ id, tokenHash: randomId(), createdAt: t, expiresAt: t + 60_000 });
  return id;
}

async function readyReading(session: string) {
  const draft = await createReading(session, "work", "What should I consider before changing jobs?");
  await updateSelection(draft.id, session, draft.revision, [0, 1, 2], true, undefined);
  expect((await requestInterpretation(draft.id, session, "1.1.1.1")).status).toBe("succeeded");
  return draft.id;
}

const get = (id: string) => GET(new Request(`https://tarotova.example/api/readings/${id}/followups`), { params: Promise.resolve({ id }) });
const post = (id: string, body: unknown) =>
  POST(new Request(`https://tarotova.example/api/readings/${id}/followups`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

beforeEach(async () => {
  await db.delete(rateLimitBuckets);
  vi.stubEnv("GENERATION_ENABLED", "true");
  vi.stubEnv("FOLLOWUPS_ENABLED", "true");
  vi.stubEnv("GENERATION_PROVIDER", "stub");
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("/api/readings/[id]/followups", () => {
  it("lists privately for the owner and is a 404 for a stranger", async () => {
    const session = await createSession();
    vi.mocked(resolveSession).mockResolvedValue({ id: session, isNew: false });
    const id = await readyReading(session);
    const res = await get(id);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await res.json()).toMatchObject({ status: "ready", available: true, remaining: 3, turns: [] });
    vi.mocked(resolveSession).mockResolvedValue({ id: await createSession(), isNew: false });
    expect((await get(id)).status).toBe(404);
  });

  it("accepts a turn, returns it with a request id, and rejects bad bodies", async () => {
    const session = await createSession();
    vi.mocked(resolveSession).mockResolvedValue({ id: session, isNew: false });
    const id = await readyReading(session);
    const res = await post(id, { submissionId: "abc12345", text: "How do these cards connect?" });
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Request-Id")).toBeTruthy();
    const body = await res.json();
    expect(body.turns[0]).toMatchObject({ status: "succeeded", submissionId: "abc12345" });
    expect(body.remaining).toBe(2);
    expect((await post(id, { submissionId: "short", text: "x" })).status).toBe(400);
    expect((await post(id, { submissionId: "abc12345x", text: "" })).status).toBe(400);
    expect((await post(id, { submissionId: "abc12345y", text: "x".repeat(501) })).status).toBe(400);
  });

  it("maps state problems to 409 with the code", async () => {
    const session = await createSession();
    vi.mocked(resolveSession).mockResolvedValue({ id: session, isNew: false });
    const id = await readyReading(session);
    await post(id, { submissionId: "abc12345", text: "First" });
    const conflict = await post(id, { submissionId: "abc12345", text: "Different" });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: "submission_conflict" });
  });

  it("says disabled when the follow-ups flag is off", async () => {
    vi.stubEnv("FOLLOWUPS_ENABLED", "false");
    const session = await createSession();
    vi.mocked(resolveSession).mockResolvedValue({ id: session, isNew: false });
    const id = await readyReading(session);
    expect(await (await get(id)).json()).toMatchObject({ status: "disabled" });
    const res = await post(id, { submissionId: "abc12345", text: "Hello" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "followups_disabled" });
  });
});
