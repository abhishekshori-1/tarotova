// One-off generator for placeholder card art (PLAN.md section 1 scope
// contingency + section 2 visual direction). These are simple original
// line-drawings sharing one frame/palette — coherent, but not the
// commissioned illustrator artwork the real release needs. Re-run with
// `node scripts/generate-card-svgs.mjs` after editing GLYPHS below.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CARDS } from "../src/content/cards.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, "../public/cards");
mkdirSync(OUT, { recursive: true });

// Palette follows docs/PLAN-EXTENDED.md section 3: faces are parchment with
// ink linework and a gold frame (they are revealed on the parchment reading
// surface); the back belongs to the night stage.
const PLUM = "#30253b"; // ink
const BRONZE = "#b8955a"; // gold, darkened for contrast on parchment
const IVORY = "#f6f0e7"; // parchment
const SAGE = "#4f5e48";
const NIGHT = "#211b30";
const GOLD = "#d5b47a";
const VIOLET = "#ac9bcb";

const W = 240;
const H = 384;
const CX = W / 2;

function frame({ glyph, numeral, name }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${name}">
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${IVORY}" stroke="${BRONZE}" stroke-width="3"/>
  <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="8" fill="none" stroke="${VIOLET}" stroke-width="1" opacity="0.7"/>
  <text x="${CX}" y="46" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="22" fill="${BRONZE}">${numeral}</text>
  <g stroke="${PLUM}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round">
    ${glyph}
  </g>
  <text x="${CX}" y="${H - 22}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="15" fill="${PLUM}" letter-spacing="0.5">${name}</text>
</svg>`;
}

const CY = 190;

const GLYPHS = {
  "major-00-fool": `<circle cx="${CX}" cy="${CY - 55}" r="20" stroke="${BRONZE}"/>
    <line x1="${CX - 45}" y1="${CY + 60}" x2="${CX + 55}" y2="${CY + 40}"/>
    <path d="M ${CX - 10} ${CY - 30} q 20 40 0 90" />
    <circle cx="${CX - 10}" cy="${CY - 30}" r="10"/>`,
  "major-01-magician": `<path d="M ${CX} ${CY - 60} m -18,0 a 18,18 0 1,0 36,0 a 18,18 0 1,0 -36,0" />
    <line x1="${CX - 50}" y1="${CY + 40}" x2="${CX + 50}" y2="${CY + 40}"/>
    <line x1="${CX}" y1="${CY - 10}" x2="${CX}" y2="${CY + 55}" stroke="${BRONZE}"/>`,
  "major-02-high-priestess": `<path d="M ${CX + 18} ${CY - 55} a 24 24 0 1 1 0 46 a 30 30 0 0 0 0 -46 z" fill="${PLUM}" stroke="none"/>
    <line x1="${CX - 55}" y1="${CY - 40}" x2="${CX - 55}" y2="${CY + 60}" stroke="${BRONZE}"/>
    <line x1="${CX + 55}" y1="${CY - 40}" x2="${CX + 55}" y2="${CY + 60}" stroke="${BRONZE}"/>`,
  "major-03-empress": `<circle cx="${CX}" cy="${CY - 30}" r="10" fill="${BRONZE}" stroke="none"/>
    <path d="M ${CX - 40} ${CY + 55} q 40 -70 80 0" />
    <path d="M ${CX - 25} ${CY + 20} q 25 -35 50 0" stroke="${SAGE}"/>`,
  "major-04-emperor": `<path d="M ${CX - 35} ${CY + 55} l 0 -70 l 70 0 l 0 70" />
    <path d="M ${CX - 20} ${CY - 15} l 20 -30 l 20 30 z" stroke="${BRONZE}"/>`,
  "major-05-hierophant": `<line x1="${CX - 30}" y1="${CY - 45}" x2="${CX - 10}" y2="${CY + 45}"/>
    <circle cx="${CX - 30}" cy="${CY - 45}" r="9"/>
    <line x1="${CX + 30}" y1="${CY - 45}" x2="${CX + 10}" y2="${CY + 45}" stroke="${BRONZE}"/>
    <circle cx="${CX + 30}" cy="${CY - 45}" r="9" stroke="${BRONZE}"/>`,
  "major-06-lovers": `<circle cx="${CX - 20}" cy="${CY}" r="30"/>
    <circle cx="${CX + 20}" cy="${CY}" r="30" stroke="${BRONZE}"/>
    <circle cx="${CX}" cy="${CY - 60}" r="14" stroke="${SAGE}"/>`,
  "major-07-chariot": `<rect x="${CX - 35}" y="${CY - 20}" width="70" height="45"/>
    <circle cx="${CX - 30}" cy="${CY + 45}" r="16" stroke="${BRONZE}"/>
    <circle cx="${CX + 30}" cy="${CY + 45}" r="16" stroke="${BRONZE}"/>`,
  "major-08-strength": `<path d="M ${CX} ${CY - 55} m -16,0 a 16,16 0 1,0 32,0 a 16,16 0 1,0 -32,0"/>
    <path d="M ${CX - 50} ${CY + 45} q 50 -60 100 0" stroke="${BRONZE}"/>`,
  "major-09-hermit": `<line x1="${CX}" y1="${CY - 20}" x2="${CX}" y2="${CY + 60}"/>
    <path d="M ${CX - 22} ${CY - 40} l 22 -25 l 22 25 z" stroke="${BRONZE}"/>
    <circle cx="${CX}" cy="${CY - 55}" r="6" fill="${BRONZE}" stroke="none"/>`,
  "major-10-wheel": `<circle cx="${CX}" cy="${CY}" r="45"/>
    <line x1="${CX}" y1="${CY - 45}" x2="${CX}" y2="${CY + 45}" stroke="${BRONZE}"/>
    <line x1="${CX - 45}" y1="${CY}" x2="${CX + 45}" y2="${CY}" stroke="${BRONZE}"/>`,
  "major-11-justice": `<line x1="${CX}" y1="${CY - 55}" x2="${CX}" y2="${CY + 30}"/>
    <line x1="${CX - 50}" y1="${CY - 30}" x2="${CX + 50}" y2="${CY - 30}"/>
    <path d="M ${CX - 50} ${CY - 30} l -14 30 h 28 z" stroke="${BRONZE}"/>
    <path d="M ${CX + 50} ${CY - 30} l -14 30 h 28 z" stroke="${BRONZE}"/>`,
  "major-12-hanged-man": `<line x1="${CX - 40}" y1="${CY - 45}" x2="${CX + 40}" y2="${CY - 45}"/>
    <line x1="${CX}" y1="${CY - 45}" x2="${CX}" y2="${CY - 10}"/>
    <circle cx="${CX}" cy="${CY + 5}" r="14" stroke="${BRONZE}"/>
    <line x1="${CX}" y1="${CY + 19}" x2="${CX}" y2="${CY + 55}" stroke="${BRONZE}"/>`,
  "major-13-death": `<line x1="${CX - 55}" y1="${CY + 15}" x2="${CX + 55}" y2="${CY + 15}"/>
    <path d="M ${CX - 45} ${CY + 15} a 45 45 0 0 1 90 0" stroke="${BRONZE}"/>
    <path d="M ${CX} ${CY + 15} l 6 -14 l -6 -6 l -6 6 z" fill="${SAGE}" stroke="none"/>`,
  "major-14-temperance": `<circle cx="${CX - 35}" cy="${CY - 10}" r="16"/>
    <circle cx="${CX + 35}" cy="${CY - 10}" r="16" stroke="${BRONZE}"/>
    <path d="M ${CX - 22} ${CY - 5} q 22 30 44 0" stroke="${SAGE}"/>`,
  "major-15-devil": `<path d="M ${CX - 30} ${CY - 30} l 30 -25 l 30 25" stroke="${BRONZE}"/>
    <circle cx="${CX}" cy="${CY + 10}" r="30"/>
    <path d="M ${CX - 25} ${CY + 55} q 25 20 50 0" stroke="${SAGE}"/>`,
  "major-16-tower": `<rect x="${CX - 25}" y="${CY - 55}" width="50" height="110"/>
    <path d="M ${CX - 25} ${CY} l 20 -10 l -10 20 l 20 -10" stroke="${BRONZE}"/>
    <path d="M ${CX - 10} ${CY - 65} l 10 -20 l 10 20" stroke="${SAGE}"/>`,
  "major-17-star": `<path d="M ${CX} ${CY - 55} l 10 24 l 26 2 l -20 17 l 7 26 l -23 -14 l -23 14 l 7 -26 l -20 -17 l 26 -2 z" stroke="${BRONZE}"/>
    <path d="M ${CX - 50} ${CY + 55} q 25 -15 50 0 q 25 15 50 0" stroke="${SAGE}"/>`,
  "major-18-moon": `<path d="M ${CX + 15} ${CY - 55} a 32 32 0 1 0 0 64 a 24 24 0 1 1 0 -64 z" fill="${PLUM}" stroke="none"/>
    <path d="M ${CX - 55} ${CY + 55} q 25 -20 50 0 q 25 20 50 0" stroke="${BRONZE}"/>`,
  "major-19-sun": `<circle cx="${CX}" cy="${CY - 5}" r="26"/>
    <g stroke="${BRONZE}">
      <line x1="${CX}" y1="${CY - 55}" x2="${CX}" y2="${CY - 65}"/>
      <line x1="${CX + 39}" y1="${CY - 5}" x2="${CX + 49}" y2="${CY - 5}"/>
      <line x1="${CX - 39}" y1="${CY - 5}" x2="${CX - 49}" y2="${CY - 5}"/>
      <line x1="${CX + 28}" y1="${CY - 33}" x2="${CX + 35}" y2="${CY - 40}"/>
      <line x1="${CX - 28}" y1="${CY - 33}" x2="${CX - 35}" y2="${CY - 40}"/>
      <line x1="${CX + 28}" y1="${CY + 23}" x2="${CX + 35}" y2="${CY + 30}"/>
      <line x1="${CX - 28}" y1="${CY + 23}" x2="${CX - 35}" y2="${CY + 30}"/>
    </g>`,
  "major-20-judgement": `<path d="M ${CX} ${CY - 55} l 0 45 l 25 15 l -50 0 l 25 -15 z" stroke="${BRONZE}"/>
    <line x1="${CX - 45}" y1="${CY + 45}" x2="${CX + 45}" y2="${CY + 45}"/>`,
  "major-21-world": `<ellipse cx="${CX}" cy="${CY}" rx="48" ry="60" stroke="${BRONZE}"/>
    <circle cx="${CX}" cy="${CY}" r="16"/>`,
};

for (const card of CARDS) {
  const glyph = GLYPHS[card.id];
  if (!glyph) throw new Error(`Missing glyph for ${card.id}`);
  const svg = frame({ glyph, numeral: card.numeral, name: card.name });
  writeFileSync(path.join(OUT, `${card.id}.svg`), svg, "utf-8");
}

const back = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Card back">
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="14" fill="${NIGHT}" stroke="${GOLD}" stroke-width="3"/>
  <rect x="14" y="14" width="${W - 28}" height="${H - 28}" rx="8" fill="none" stroke="${GOLD}" stroke-width="1" opacity="0.7"/>
  <circle cx="${CX}" cy="${CY}" r="58" fill="none" stroke="${VIOLET}" stroke-width="1" opacity="0.5"/>
  <circle cx="${CX}" cy="${CY}" r="42" fill="none" stroke="${GOLD}" stroke-width="1.5"/>
  <circle cx="${CX}" cy="${CY}" r="22" fill="none" stroke="${GOLD}" stroke-width="1.5"/>
  <circle cx="${CX}" cy="${CY}" r="4" fill="${GOLD}"/>
  <path d="M ${CX} ${CY - 74} l 0 148 M ${CX - 74} ${CY} l 148 0" stroke="${IVORY}" stroke-width="1" opacity="0.35"/>
  <g fill="${IVORY}" opacity="0.7">
    <circle cx="42" cy="58" r="1.5"/><circle cx="196" cy="84" r="1.2"/><circle cx="64" cy="318" r="1.2"/>
    <circle cx="184" cy="300" r="1.5"/><circle cx="120" cy="40" r="1"/><circle cx="120" cy="344" r="1"/>
  </g>
</svg>`;
writeFileSync(path.join(OUT, "back.svg"), back, "utf-8");

console.log(`Wrote ${CARDS.length + 1} SVGs to ${OUT}`);
