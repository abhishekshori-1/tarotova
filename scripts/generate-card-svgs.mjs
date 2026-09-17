// Reproduce the 19 completed compositions. The three individually authored
// studies and approved card back are source assets and are never overwritten.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { SCENES } from "./card-scenes.mjs";

const root = new URL("../", import.meta.url);
const library = readFileSync(new URL("src/content/cards.ts", root), "utf8");
const cards = [...library.matchAll(/id: "([^"]+)"[\s\S]*?name: "([^"]+)"[\s\S]*?numeral: "([^"]+)"/g)];
const studies = new Set(["major-00-fool", "major-16-tower", "major-17-star"]);
const escape = (text) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
let written = 0;
for (const [, id, name, numeral] of cards) {
  if (studies.has(id)) continue;
  const scene = SCENES[id];
  if (!scene) throw new Error(`Missing composition for ${id}`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 384" role="img" aria-label="${escape(name)}">
  <title>${escape(name)}</title>
  <defs>
    <linearGradient id="gold" x2="0" y2="1"><stop stop-color="#e3c68e"/><stop offset="1" stop-color="#b8955a"/></linearGradient>
    <linearGradient id="sky" x2="0" y2="1"><stop stop-color="#211b30"/><stop offset="1" stop-color="#625173"/></linearGradient>
    <linearGradient id="day" x2="0" y2="1"><stop stop-color="#f5e7c8"/><stop offset="1" stop-color="#e5d6cf"/></linearGradient>
    <pattern id="engraving" width="7" height="7" patternUnits="userSpaceOnUse"><path d="M0 7 L7 0" stroke="#30253b" opacity=".045" stroke-width=".6"/></pattern>
    <clipPath id="picture"><rect x="18" y="58" width="204" height="272" rx="6"/></clipPath>
  </defs>
  <rect x="1" y="1" width="238" height="382" rx="14" fill="#f6f0e7" stroke="url(#gold)" stroke-width="3"/>
  <rect x="12" y="12" width="216" height="360" rx="8" fill="none" stroke="#ac9bcb" opacity=".7"/>
  <text x="120" y="46" text-anchor="middle" font-family="Georgia,serif" font-size="22" fill="#b8955a">${escape(numeral)}</text>
  <g clip-path="url(#picture)" stroke="#30253b" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
    ${scene}
    <rect x="18" y="58" width="204" height="272" fill="url(#engraving)" stroke="none"/>
  </g>
  <rect x="18" y="58" width="204" height="272" rx="6" fill="none" stroke="#b8955a" opacity=".8"/>
  <text x="120" y="362" text-anchor="middle" font-family="Georgia,serif" font-size="${name.length > 16 ? 13 : 15}" fill="#30253b" letter-spacing=".3">${escape(name)}</text>
</svg>
`;
  writeFileSync(new URL(`public/cards/${id}.svg`, root), svg);
  written++;
}
if (cards.length !== 22 || written !== 19) throw new Error("Expected 22 cards and 19 generated compositions");
console.log(`Wrote ${written} compositions; preserved the three studies and card back in ${fileURLToPath(new URL("public/cards/", root))}`);
