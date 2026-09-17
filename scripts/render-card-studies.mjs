// Local, offline contact sheets for reviewing the actual SVG source assets.
import { chromium } from 'playwright';
import { readFileSync, readdirSync } from 'node:fs';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  const img = (file) => `<img alt="${file}" src="data:image/svg+xml;base64,${readFileSync(`public/cards/${file}`).toString('base64')}">`;
  const files = readdirSync('public/cards').filter((file) => file.endsWith('.svg')).sort();
  await page.setContent(`<style>body{margin:0;padding:24px;background:#14111f;color:#f5ebdd;font:16px Georgia}h1{font-weight:400}main{display:grid;grid-template-columns:repeat(6,1fr);gap:20px}img{width:100%;display:block}figure{margin:0}</style><h1>Tarotova · complete 22-card composition study</h1><main>${files.map((file) => `<figure>${img(file)}</figure>`).join('')}</main>`);
  await page.screenshot({ path: 'docs/screens/reading-experience/deck-complete.png', fullPage: true });
  await page.setViewportSize({ width: 1200, height: 500 });
  await page.setContent(`<style>body{margin:0;background:#14111f;display:flex;gap:24px;padding:16px}img{width:270px;height:432px}</style>${['back.svg', 'major-00-fool.svg', 'major-17-star.svg', 'major-16-tower.svg'].map(img).join('')}`);
  await page.screenshot({ path: 'docs/screens/reading-experience/card-studies.png' });
} finally {
  await browser.close();
}
