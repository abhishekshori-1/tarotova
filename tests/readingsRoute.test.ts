import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/readings/route";
import { db } from "@/server/db/client";
import { browserSessions, rateLimitBuckets } from "@/server/db/schema";
import { randomId } from "@/server/ids";
import { resolveSession } from "@/server/session";

vi.mock("@/server/db/migrate", () => ({ ensureMigrated: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/server/session", () => ({ resolveSession: vi.fn() }));

function request(body?: string) {
  return POST(new Request("https://tarotova.example/api/readings", {
    method: "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body,
  }));
}

beforeEach(async () => {
  await db.delete(rateLimitBuckets);
  const id = randomId();
  const t = Date.now();
  await db.insert(browserSessions).values({ id, tokenHash: randomId(), createdAt: t, expiresAt: t + 60_000 });
  vi.mocked(resolveSession).mockResolvedValue({ id, isNew: false });
});

afterEach(() => vi.restoreAllMocks());

describe("POST /api/readings", () => {
  it("creates a general reading from an empty body", async () => {
    const response = await request();
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await response.json();
    expect(body.state).toBe("drafting");
    expect(body.focus).toBe("general");
  });

  it("accepts an initial focus in the same request", async () => {
    const response = await request(JSON.stringify({ focus: "relationships" }));
    expect(response.status).toBe(201);
    expect((await response.json()).focus).toBe("relationships");
  });

  it.each([JSON.stringify({ focus: "money" }), "{not json"])("rejects %s as a bad request", async (body) => {
    const response = await request(body);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_request" });
  });
});
