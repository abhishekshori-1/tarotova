"use client";

import Image from "next/image";

interface Props {
  slot: number;
  order?: number; // 1-3 when selected, undefined otherwise
  disabled?: boolean;
  onClick: () => void;
}

export function CardBackSlot({ slot, order, disabled, onClick }: Props) {
  const selected = order !== undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={selected ? `Card slot ${slot + 1}, selected as card ${order}. Activate to deselect.` : `Card slot ${slot + 1}. Activate to select.`}
      className={`card-frame group relative aspect-[5/8] w-full min-h-11 rounded-[0.6rem] transition-transform duration-200 ease-out ${
        selected ? "-translate-y-2 ring-2 ring-[var(--gold)] ring-offset-2 ring-offset-[var(--night)]" : "hover:-translate-y-1"
      } disabled:opacity-40 disabled:pointer-events-none motion-reduce:transform-none`}
    >
      <Image src="/cards/back.svg" alt="" fill sizes="(min-width: 1200px) 140px, (min-width: 600px) 16vw, 22vw" priority={slot < 8} className="rounded-[0.6rem]" />
      {selected && (
        <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--gold)] text-xs font-semibold text-[var(--night)]">
          {order}
        </span>
      )}
    </button>
  );
}
