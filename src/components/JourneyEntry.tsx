import Link from "next/link";
import { getJourneyEntryView } from "@/server/journeyEntry";

export async function JourneyEntry() {
  // No client request, no new session, and no database work without a session cookie.
  let view;
  try { view = await getJourneyEntryView(); }
  catch { return null; } // Discovery must not prevent the reading form from loading.
  if (!view || (!view.enabled && !view.active.length)) return null;
  return <section className="mt-12 border-t border-[var(--line)] pt-8" aria-label="Guided journeys">
    <p className="eyebrow">A little structure, at your pace</p>
    {view.active.map((run) => <Link key={run.id} href={`/journey/${run.id}`} className="journey-tile mt-4"><span className="block text-sm text-[var(--fg-soft)]">Continue your journey</span><span className="mt-1 block font-serif text-xl">{run.title}</span></Link>)}
    {view.enabled && <Link href="/journeys" className="btn-secondary mt-4 inline-flex items-center px-5">Explore guided journeys <span className="ml-3" aria-hidden="true">→</span></Link>}
  </section>;
}
