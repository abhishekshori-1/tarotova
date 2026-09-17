"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

/** A card face at a fixed 5:8 aspect ratio; the frame is the only decoration, the art carries the rest. */
export function CardFace({ id, name, sizes, priority, className = "", alt }: { id: string; name: string; sizes: string; priority?: boolean; className?: string; alt?: string }) {
  return (
    <div className={`relative aspect-[5/8] w-full overflow-hidden rounded-[0.75rem] ${className}`}>
      <Image src={`/cards/${id}.svg`} alt={alt ?? name} fill sizes={sizes} priority={priority} className="rounded-[0.75rem]" />
    </div>
  );
}

export function CardBack({ sizes, priority, className = "" }: { sizes: string; priority?: boolean; className?: string }) {
  return (
    <div className={`relative aspect-[5/8] w-full overflow-hidden rounded-[0.75rem] ${className}`}>
      <Image src="/cards/back.svg" alt="" fill sizes={sizes} priority={priority} className="rounded-[0.75rem]" />
    </div>
  );
}

/**
 * An accessible enlarged view of one card: a native dialog, closed by
 * Escape, the backdrop or the button; focus returns to the opener.
 */
export function CardLightbox({ card, onClose }: { card: { id: string; name: string; numeral: string; position: string } | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (card && !dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    }
    if (!card && dialog.open) dialog.close();
  }, [card]);
  const onClick = useCallback((e: React.MouseEvent<HTMLDialogElement>) => { if (e.target === ref.current) onClose(); }, [onClose]);
  return (
    <dialog ref={ref} className="card-lightbox" onClose={() => {
      const target = opener.current;
      opener.current = null;
      onClose();
      if (target?.isConnected) target.focus({ preventScroll: true });
    }} onClick={onClick} aria-label={card ? `${card.name}, enlarged` : "Card"}>
      {card && (
        <div className="card-lightbox-body">
          <CardFace id={card.id} name={card.name} sizes="(min-width: 640px) 400px, 90vw" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm"><span className="font-serif text-lg">{card.name}</span> <span className="text-[var(--ink-soft)]">({card.numeral}) · {card.position}</span></p>
            <button type="button" onClick={onClose} className="btn-secondary px-4 text-sm" style={{ color: "var(--ink)", borderColor: "var(--parchment-line)" }}>Close</button>
          </div>
        </div>
      )}
    </dialog>
  );
}

/** Small hook so any page can open the lightbox for one card. */
export function useCardLightbox() {
  const [card, setCard] = useState<{ id: string; name: string; numeral: string; position: string } | null>(null);
  return { card, open: setCard, close: () => setCard(null) };
}
