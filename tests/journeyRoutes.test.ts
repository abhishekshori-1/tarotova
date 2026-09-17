import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/journeys/route";
import { PATCH, GET as getRun } from "@/app/api/journeys/[id]/route";
import { resolveSession, readSession, hasSessionCookie } from "@/server/session";
import { db } from "@/server/db/client";
import { browserSessions } from "@/server/db/schema";
import { randomId } from "@/server/ids";
vi.mock("@/server/session", () => ({ resolveSession: vi.fn(), readSession: vi.fn(), hasSessionCookie: vi.fn() }));
let sid: string;
beforeEach(async () => {
  vi.stubEnv("JOURNEYS_ENABLED", "true"); sid = randomId();
  await db.insert(browserSessions).values({ id: sid, tokenHash: randomId(), createdAt: Date.now(), expiresAt: Date.now() + 86400000 });
  vi.mocked(resolveSession).mockResolvedValue({ id: sid, isNew: false });
  vi.mocked(readSession).mockResolvedValue(null);
  vi.mocked(hasSessionCookie).mockResolvedValue(false);
});
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
it("resume discovery is private and does not create a competing session for a new visitor", async () => {
  const response = await GET();
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.json()).toEqual({ enabled: true, active: [] });
  expect(resolveSession).not.toHaveBeenCalled();
});
it("rejects malformed mutations and never accepts reflection notes", async () => {
  const req = (body: unknown) => new Request("http://localhost/api/journeys", { method: "POST", body: JSON.stringify(body) });
  expect((await POST(req({ slug: "navigating-change", submissionId: randomId(), question: "A question", privateNote: "Do not store" }))).status).toBe(400);
  const created = await POST(req({ slug: "navigating-change", submissionId: randomId(), question: "A question" }));
  expect(created.status).toBe(201);
  const run = await created.json();
  const context = { params: Promise.resolve({ id: run.id }) };
  const bad = await PATCH(req({ revision: 0, submissionId: randomId(), destination: "complete", privateNote: "No" }), context);
  expect(bad.status).toBe(400);
  vi.mocked(resolveSession).mockResolvedValue({ id: randomId(), isNew: false });
  expect((await getRun(new Request("http://localhost"), context)).status).toBe(404);
});
