// Repeatable, offline lab measurements against a local production build.
// Fixtures replace generation; these numbers cannot certify hosted latency or field INP.
import { chromium } from 'playwright';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const base = new URL(process.argv[2] ?? 'http://localhost:47103');
if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('This offline measurement script accepts a loopback build only.');
const compiled = ts.transpileModule(readFileSync('e2e/fixtures/developed-reading.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { answer, question, reply } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const cards = [
  ['situation', 'major-00-fool', 'The Fool', '0'],
  ['challenge', 'major-07-chariot', 'The Chariot', 'VII'],
  ['guidance', 'major-09-hermit', 'The Hermit', 'IX'],
].map(([position, id, name, numeral]) => ({ position, id, name, numeral, keywords: ['A theme to consider'], interpretation: 'General library meaning.', focusNote: 'A general focus note.' }));
mkdirSync('data/review-pass', { recursive: true });
mkdirSync('docs/screens/reading-experience/candidate', { recursive: true });
const browser = await chromium.launch();
const records = [];
try {
  for (const width of [390, 1440]) for (const route of ['home', 'reading']) for (let repeat = 1; repeat <= 3; repeat++) {
    const context = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      const cdp = await context.newCDPSession(page);
      if (width === 390) {
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await cdp.send('Network.enable');
        await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 1_600_000 / 8, uploadThroughput: 750_000 / 8 });
      }
      await page.addInitScript(() => {
        window.__lab = { lcp: 0, cls: 0, events: [], lcpElement: '' };
        new PerformanceObserver((list) => { for (const e of list.getEntries()) { window.__lab.lcp = e.startTime; window.__lab.lcpElement = e.element?.tagName ?? ''; } }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput) window.__lab.cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver((list) => { for (const e of list.getEntries()) if (e.interactionId) window.__lab.events.push(e.duration); }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
      });
      if (route === 'reading') {
        await page.route('**/api/readings/lab/status', (r) => r.fulfill({ json: { state: 'locked' } }));
        await page.route('**/api/readings/lab/result', (r) => r.fulfill({ json: {
          question, focus: 'work', cards, overview: 'Library overview.', reflection: 'Library reflection.',
          interpretation: { status: 'succeeded', model: 'layout-fixture', promptVersion: 'layout-fixture', answer },
        } }));
        await page.route('**/api/readings/lab/followups', (r) => r.fulfill({ json: { status: 'ready', available: true, remaining: 2, turns: [
          { sequence: 1, submissionId: 'lab-1', text: 'How could I look at the unfamiliar part?', status: 'succeeded', answer: reply },
        ] } }));
      }
      await page.goto(new URL(route === 'home' ? '/' : '/reading/lab/result', base).href, { waitUntil: 'networkidle' });
      await page.locator('h1').waitFor();
      await page.evaluate(() => document.fonts.ready);
      if (route === 'reading') await page.locator('#connect').waitFor();
      const readyMs = await page.evaluate(() => performance.now());
      // Let buffered paint entries arrive before starting interactions.
      await page.waitForTimeout(500);
      if (route === 'reading') {
        await page.getByRole('button', { name: 'Enlarge The Fool', exact: true }).click();
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Ask about this reading', exact: true }).click();
        await page.getByLabel('Your follow-up').pressSequentially('What else could matter?');
      } else {
        await page.getByLabel('Your question', { exact: false }).pressSequentially('What would I like to understand?');
        await page.getByRole('button', { name: 'Work', exact: true }).click();
      }
      await page.waitForTimeout(250);
      const measured = await page.evaluate(() => ({ ...window.__lab, overflow: document.documentElement.scrollWidth - innerWidth }));
      const sample = { route, width, repeat, mobileThrottle: width === 390, readyMs: Math.round(readyMs), lcpMs: Math.round(measured.lcp), cls: Number(measured.cls.toFixed(4)), largestObservedInteractionMs: measured.events.length ? Math.max(...measured.events) : null, overflow: measured.overflow, errors };
      records.push(sample);
      console.log(JSON.stringify(sample));
      if (repeat === 1) {
        await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
        await page.screenshot({ path: `docs/screens/reading-experience/candidate/${route}-long-${width}.png`, fullPage: true });
      }
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  writeFileSync('data/review-pass/reading-performance.json', JSON.stringify({ conditions: 'Local production build; fresh browser context per sample; mobile: 4x CPU slowdown, 1.6 Mbps down/0.75 Mbps up, 150ms latency. Reading API is a layout fixture. Interaction maximum is a lab proxy, not field INP. No provider calls.', records }, null, 2));
}
