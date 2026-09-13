const STEPS = ["Your question", "Your cards", "Reveal"] as const;

/** Quiet three-step indicator (docs/PLAN-EXTENDED.md section 4). */
export function ReadingProgress({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--fg-soft)]" aria-label="Progress">
      {STEPS.map((label, i) => (
        <li key={label} className="flex items-center gap-2" aria-current={i === current ? "step" : undefined}>
          <span className={i <= current ? "text-[var(--accent)]" : undefined}>{label}</span>
          {i < STEPS.length - 1 && <span aria-hidden="true" className={`h-px w-6 ${i < current ? "bg-[var(--accent)]" : "bg-[var(--line)]"}`} />}
        </li>
      ))}
    </ol>
  );
}
