import { afterEach, expect, it, vi } from "vitest";
import { getJourneyEntryView } from "@/server/journeyEntry";
import { hasSessionCookie, readSession } from "@/server/session";
import { ensureMigrated } from "@/server/db/migrate";
import { listJourneys } from "@/server/journeys";
import JourneysPage from "@/app/(parchment)/journeys/page";
import JourneyPreview from "@/app/(parchment)/journeys/[slug]/page";
vi.mock("@/server/session", () => ({ hasSessionCookie: vi.fn(), readSession: vi.fn() }));
vi.mock("@/server/db/migrate", () => ({ ensureMigrated: vi.fn() }));
vi.mock("@/server/journeys", () => ({ journeysEnabled: () => process.env.JOURNEYS_ENABLED === "true", listJourneys: vi.fn() }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not_found"); } }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
it("does no database work for an anonymous visit with journeys off", async () => {
  vi.stubEnv("JOURNEYS_ENABLED", "false");
  vi.mocked(hasSessionCookie).mockResolvedValue(false);
  expect(await getJourneyEntryView()).toEqual({ enabled: false, active: [] });
  expect(readSession).not.toHaveBeenCalled(); expect(ensureMigrated).not.toHaveBeenCalled(); expect(listJourneys).not.toHaveBeenCalled();
});
it("keeps resume when off without exposing discovery", async () => {
  vi.stubEnv("JOURNEYS_ENABLED", "false");
  vi.mocked(hasSessionCookie).mockResolvedValue(true);
  vi.mocked(readSession).mockResolvedValue({ id: "owner", isNew: false });
  vi.mocked(listJourneys).mockResolvedValue({ enabled: false, active: [{ id: "saved", title: "Saved journey", stage: "explore" }] });
  expect((await getJourneyEntryView()).active[0].id).toBe("saved");
  expect(listJourneys).toHaveBeenCalledWith("owner");
});
it("hides both template routes when the flag is off", async () => {
  vi.stubEnv("JOURNEYS_ENABLED", "false");
  expect(() => JourneysPage()).toThrow("not_found");
  await expect(JourneyPreview({ params: Promise.resolve({ slug: "navigating-change" }) })).rejects.toThrow("not_found");
});
