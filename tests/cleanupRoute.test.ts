import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/internal/cleanup/route";

vi.mock("@/server/db/migrate", () => ({ ensureMigrated: vi.fn().mockResolvedValue(undefined) }));

function call(authorization?: string) {
  return GET(new Request("https://tarotova.example/api/internal/cleanup", { headers: authorization ? { authorization } : {} }));
}

beforeEach(() => {
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("cleanup route", () => {
  it("refuses every call when no secret is configured", async () => {
    vi.stubEnv("CRON_SECRET", undefined);
    expect((await call("Bearer anything")).status).toBe(404);
    expect((await call()).status).toBe(404);
  });

  it("refuses a wrong or missing bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    expect((await call()).status).toBe(404);
    expect((await call("Bearer nope")).status).toBe(404);
    expect((await call("Bearer s3cre")).status).toBe(404);
  });

  it("runs the retention job for the configured token and reports counts", async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    const res = await call("Bearer s3cret");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.deleted).toEqual(expect.objectContaining({ readings: expect.any(Number), sessions: expect.any(Number) }));
    expect(console.info).toHaveBeenCalledWith("[cleanup]", expect.objectContaining({ durationMs: expect.any(Number) }));
  });
});
