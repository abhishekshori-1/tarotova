import { notFound } from "next/navigation";
import { journeysEnabled } from "@/server/journeys";
import Link from "next/link";
import { JOURNEYS } from "@/content/journeys";
import { JourneyMotif } from "@/components/JourneyMotif";
import { JourneyEntry } from "@/components/JourneyEntry";
export const dynamic = "force-dynamic";
export default function JourneysPage() {
  if (!journeysEnabled()) notFound();
  return <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
    <p className="eyebrow">Guided journeys</p><h1 className="display mt-3">A question. A little room.</h1>
    <p className="prose-measure mt-5 text-lg text-[var(--fg-soft)]">Three stages to explore what matters to you. Frame your question, spend time with one reading, then choose what to take with you.</p>
    <p className="prose-measure mt-3 text-sm text-[var(--fg-soft)]">One three-card spread. Follow-ups are optional. Finish without writing a note or making a plan.</p>
    <div className="mt-10 grid gap-5 md:grid-cols-3">{JOURNEYS.map((j) => <Link key={j.slug} href={`/journeys/${j.slug}`} className="journey-tile"><JourneyMotif motif={j.motif}/><h2 className="mt-5 text-2xl">{j.title}</h2><p className="mt-3 text-[var(--fg-soft)]">{j.purpose}</p><span className="mt-6 block text-sm font-medium">Explore this journey <span aria-hidden="true">→</span></span></Link>)}</div>
    <JourneyEntry/>
  </div>;
}
