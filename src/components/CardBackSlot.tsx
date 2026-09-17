"use client";

import { CardBack } from "@/components/CardArt";

interface Props {
  slot: number;
  order?: number; // 1-3 when selected, undefined otherwise
  disabled?: boolean;
  onClick: () => void;
}

/** One face-down card on the table. A button, so touch, keyboard and click all work without a drag. */
export function CardBackSlot({ slot, order, disabled, onClick }: Props) {
  const selected = order !== undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={selected ? `Card slot ${slot + 1}, selected as card ${order}. Activate to deselect.` : `Card slot ${slot + 1}. Activate to select.`}
      className="card-slot card-frame group relative min-h-11 w-full rounded-[0.75rem] disabled:pointer-events-none disabled:opacity-40"
    >
      <CardBack sizes="(min-width: 1200px) 140px, (min-width: 600px) 16vw, 22vw" priority={slot < 8} />
      {selected && (
        <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--gold)] font-serif text-sm font-semibold text-[var(--night)] shadow">
          {order}
        </span>
      )}
    </button>
  );
}
