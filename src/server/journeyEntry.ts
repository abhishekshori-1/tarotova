import { hasSessionCookie, readSession } from "./session";
import { ensureMigrated } from "./db/migrate";
import { journeysEnabled, listJourneys } from "./journeys";

/** Off hides discovery, but existing owners can still resume. Never creates a session. */
export async function getJourneyEntryView() {
  const empty = { enabled: journeysEnabled(), active: [] };
  if (!await hasSessionCookie()) return empty;
  await ensureMigrated();
  const session = await readSession();
  return session ? listJourneys(session.id) : empty;
}
