/** Plain stored text with paragraph breaks; never interpreted as HTML or Markdown. */
export function ReadingProse({ text, className = "" }: { text: string; className?: string }) {
  return text.split(/\r?\n\s*\r?\n/).filter((paragraph) => paragraph.trim()).map((paragraph, index) => (
    <p key={index} className={className}>{paragraph}</p>
  ));
}
