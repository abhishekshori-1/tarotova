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
      className={`group relative aspect-[5/8] w-full min-h-11 rounded-lg transition-transform duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-plum)] ${
        selected ? "-translate-y-2" : "hover:-translate-y-1"
      } disabled:opacity-40 disabled:pointer-events-none motion-reduce:transform-none`}
    >
      <Image src="/cards/back.svg" alt="" fill sizes="120px" priority={slot < 8} />
      {selected && (
        <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-bronze)] text-xs font-semibold text-[var(--color-ivory)]">
          {order}
        </span>
      )}
    </button>
  );
}
