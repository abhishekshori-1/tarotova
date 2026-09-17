import type { JourneyTemplate } from "@/content/journeys";
export function JourneyMotif({ motif }: { motif: JourneyTemplate["motif"] }) {
  return <svg viewBox="0 0 80 80" className="journey-motif" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    {motif === "threshold" ? <><path d="M18 66V34a22 22 0 0 1 44 0v32M28 66V35a12 12 0 0 1 24 0v31M12 66h56"/><circle cx="40" cy="39" r="3"/></> : motif === "conversation" ? <><circle cx="29" cy="36" r="18"/><circle cx="51" cy="44" r="18"/><path d="M29 58v9m22-44V13"/></> : <><path d="M40 9v14m0 34v14M9 40h14m34 0h14M18 18l10 10m24 24 10 10M18 62l10-10m24-24 10-10M40 26l4 10 10 4-10 4-4 10-4-10-10-4 10-4Z"/></>}
  </svg>;
}
