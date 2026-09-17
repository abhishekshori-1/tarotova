// Bumped whenever the corresponding content changes shape or wording in a
// way that should not retroactively alter an already-locked reading
// (PLAN.md section 4: "Store the result snapshot, deck version, spread
// version, and content version when the draw is locked").
export const DECK_VERSION = "major-22.v1";
export const SPREAD_VERSION = "situation-challenge-guidance.v1";
export const CONTENT_VERSION = "content.v9-draft"; // v9: authored card explorations and a connecting overview for general readings; still not practitioner-reviewed

/**
 * This build ships PLAN.md's section-1 scope contingency: 22 Major Arcana
 * cards, not the full 78-card RWS deck, because no illustrator or RWS
 * practitioner has been sourced yet (section 13). CONTENT_VERSION is
 * suffixed "-draft" because this copy has not had the practitioner review
 * section 9/177 requires as a release gate — treat every reading produced
 * by this build as a working demo, not reviewed editorial content.
 */
export const IS_REVIEWED_CONTENT = false;
