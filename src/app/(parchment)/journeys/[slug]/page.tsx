import { notFound } from "next/navigation";
import Link from "next/link";
import { journeyTemplate } from "@/content/journeys";
import { journeysEnabled } from "@/server/journeys";
import { JourneyMotif } from "@/components/JourneyMotif";
import { JourneyStart } from "@/components/JourneyStart";
export const dynamic = "force-dynamic";
export default async function JourneyPreview({ params }: { params: Promise<{ slug: string }> }) {
  if (!journeysEnabled()) notFound();
  const template = journeyTemplate((await params).slug);
  if (!template) notFound();
  return <div className="mx-auto max-w-3xl px-6 py-12">
    <Link href="/journeys" className="inline-flex min-h-11 items-center text-sm underline">All journeys</Link>
    <JourneyMotif motif={template.motif}/><h1 className="display mt-4">{template.title}</h1><p className="prose-measure mt-5 text-lg">{template.purpose}</p>
    <ol className="journey-stages mt-8" aria-label="Journey stages"><li>1 · Frame</li><li>2 · Explore</li><li>3 · Reflect</li></ol>
    <div className="mt-8 space-y-4 text-[var(--fg-soft)]"><p>Start with your own words. Choose three cards, then explore the reading and ask follow-ups if you want to.</p><p>Finish with a reflection you can keep to yourself. No extra draw, written note, or action is required. You can resume in this browser while the reading is available.</p></div>
    <JourneyStart template={template}/>
  </div>;
}
