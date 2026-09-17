# Card art provenance

Record of where each card image in `public/cards/` comes from, as
docs/PLAN-EXTENDED.md section 3 asks. All files are hand-authored SVG,
240×384 viewBox, no raster, no external fonts (Georgia with serif fallback
for the numeral and name).

| Asset | Status | Author | Date | Notes |
| --- | --- | --- | --- | --- |
| `back.svg` | approved by the owner, 17 September | Claude (assistant), directed by the product owner's plan | 2026-09-17 | Midnight observatory: layered rings, a central gold star, corner ornaments; used on the home stage, the card table and the position tray |
| `major-00-fool.svg` | study, revised 17 September after the owner's checkpoint review | as above | 2026-09-17 | Exploratory symbolism: the cliff edge, the sun, the bundle on a staff, the white rose, the small dog |
| `major-17-star.svg` | candidate, kneeling pose refined in the completion pass | Claude original; Codex (assistant) pose revision | 2026-09-17 | Knee on the bank, foot in the pool, two jugs; retained the original sky, pool, tree and bird |
| `major-16-tower.svg` | study, revised 17 September | as above | 2026-09-17 | Difficult symbolism kept thoughtful: one clean bolt, the crown lifted clear, flames at the windows, two small figures in the air as in the source image, drawn calmly |
| the other 19 faces | complete candidate compositions, replacing the Release A symbols | Codex (assistant), authored as SVG code | 2026-09-17 | Original filled figures and scenery based on the local library's image descriptions; shared parchment frame and midnight palette. Source: `scripts/card-scenes.mjs` |

The completion pass extends the existing visual direction; it does not claim
new owner approval or a practitioner's review. No downloaded illustrations,
raster generation, external image assets or external fonts were used. The
generator reads only card identity metadata from the library and preserves the
three studies and approved back. `node scripts/generate-card-svgs.mjs` rebuilds
the other 19 faces; `node scripts/render-card-studies.mjs` renders the contact
sheets directly from those SVG files.

Visual inspection covered all 22 faces at contact-sheet size. The Star's pose,
The Hermit's six-point lantern star, and the corner creatures in Wheel of
Fortune and The World were refined in this pass. These remain stylized original
illustrations rather than reproductions of a particular printed deck.

Complete candidate: [deck-complete.png](screens/reading-experience/deck-complete.png).

The public hero cards on the home page are The Star, a card back and The
Fool as illustrative examples. They have no relationship to any visitor's
private draw; card identities appear only after the server grants access to
that reading.
