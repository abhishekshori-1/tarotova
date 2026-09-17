import { describe, expect, it } from "vitest";
import { CARDS, getCardById } from "./cards";
import { POSITIONS, FOCUSES } from "./types";

// PLAN.md section 9's domain/unit row, adapted to this build's 22-card
// scope-contingency deck (see versions.ts): exact composition, correct RWS
// numbering, and full content resolution for every card/position/focus.

describe("CARDS deck composition", () => {
  it("has exactly 22 cards", () => {
    expect(CARDS).toHaveLength(22);
  });

  it("has unique ids", () => {
    const ids = CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("numbers every card 0-21 exactly once (Fool = 0)", () => {
    const numbers = CARDS.map((c) => c.number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 22 }, (_, i) => i));
    expect(getCardById("major-00-fool")?.number).toBe(0);
  });

  it("keeps Waite's numbering for Strength (VIII) and Justice (XI)", () => {
    const strength = CARDS.find((c) => c.name === "Strength");
    const justice = CARDS.find((c) => c.name === "Justice");
    expect(strength?.number).toBe(8);
    expect(strength?.numeral).toBe("VIII");
    expect(justice?.number).toBe(11);
    expect(justice?.numeral).toBe("XI");
  });

  it("gives every card a non-empty core meaning and at least one keyword", () => {
    for (const card of CARDS) {
      expect(card.coreMeaning.trim().length, `${card.id} coreMeaning`).toBeGreaterThan(0);
      expect(card.keywords.length, `${card.id} keywords`).toBeGreaterThan(0);
    }
  });

  it("resolves content for all three positions on every card (PLAN.md section 9)", () => {
    for (const card of CARDS) {
      for (const position of POSITIONS) {
        expect(card.position[position]?.trim().length, `${card.id} ${position}`).toBeGreaterThan(0);
      }
    }
  });

  it("resolves content for all four focuses on every card", () => {
    for (const card of CARDS) {
      for (const focus of FOCUSES) {
        expect(card.focus[focus]?.trim().length, `${card.id} ${focus}`).toBeGreaterThan(0);
      }
    }
  });

  it("does not reintroduce known verdict phrases from the library review", () => {
    // The personalized answer grounds itself on this text, so a finding
    // written here ("you have more than you credit", "looser than it
    // feels", "no catch") becomes a finding in someone's reading.
    // These are selected wording regressions, not a semantic guarantee.
    // New copy and complete readings still need editorial review.
    const verdicts = [
      /than it (feels|deserves|needs|probably)/i,
      /isn'?t actually/i,
      /you (already )?have (more|everything|what you need)/i,
      /a catch/i,
      /pretense/i,
      /(worry|anxiety) (can|will|tends to) fill/i,
      /is(n'?t| not) (permanent|fixed|true)\b/i,
      /(usually|tends to) (isn'?t|is not)/i,
      /ambiguity here is real|some of this is still unclear|the extreme you are used to|rather than a setback to fear/i,
      // Promises of effect and presumed facts removed in content.v7:
      /half-noticed|clarifies this faster|finds out (faster|which)|tends to pay|gets easier|usually counts for more|does work that .* cannot|lasts longer than/i,
      // Attributing a verdict to the card does not make it a theme (content.v8):
      /outlasts|has (likely )?been worked out by someone|the card's view is that/i,
    ];
    for (const card of CARDS) {
      const texts = [card.coreMeaning, card.exploration, ...Object.values(card.position), ...Object.values(card.focus)];
      for (const text of texts) for (const v of verdicts) expect(text, `${card.id}: ${text.slice(0, 60)}`).not.toMatch(v);
    }
  });

  it("gives every card an exploration in the library's stance (content.v9)", () => {
    // 80–110 words about the RWS image and theme; at most one question; no
    // permission language, no reversal, no other card's name. Wording
    // checks, not a semantic guarantee: the copy still needs editorial review.
    const permission = [/\bif it fits\b/i, /\byours to weigh\b/i, /\bone option is\b/i, /\bif that fits\b/i, /\byours to judge\b/i];
    for (const card of CARDS) {
      const text = card.exploration;
      const words = text.trim().split(/\s+/).length;
      expect(words, `${card.id} exploration words`).toBeGreaterThanOrEqual(80);
      expect(words, `${card.id} exploration words`).toBeLessThanOrEqual(110);
      expect((text.match(/\?/g) ?? []).length, `${card.id} questions`).toBeLessThanOrEqual(1);
      expect(text.toLowerCase(), `${card.id} reversal`).not.toMatch(/revers/);
      for (const p of permission) expect(text, `${card.id} permission language`).not.toMatch(p);
      expect(text, `${card.id} addresses the reader`).not.toMatch(/\byou\b/i);
      for (const other of CARDS) {
        if (other.id === card.id) continue;
        // Case-sensitive: "the sun" as an object in the sky is fine, "The Sun" is a card.
        expect(text, `${card.id} names ${other.name}`).not.toMatch(new RegExp(`(^|[^A-Za-z])${other.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![A-Za-z])`));
      }
    }
  });

  it("never reuses reversed-orientation language in a Challenge position", () => {
    // PLAN.md section 4: Challenge must name the upright card's difficulty,
    // not silently switch to a reversed meaning. Reversal isn't modeled at
    // all in this build (upright-only), so this guards against the wording
    // itself drifting toward reversal language.
    for (const card of CARDS) {
      expect(card.position.challenge.toLowerCase()).not.toMatch(/revers/);
    }
  });
});
