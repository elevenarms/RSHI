// Render deck.html to SparkleTeam-deck.pdf (1920x1080 pages, no margins) and, optionally,
// one PNG per slide for review.
//   node docs/crew/launch/deck/render.mjs [pngDir]
// Uses puppeteer-core from apps/studio and Chrome at SPOTLESS_CHROME or the default macOS path.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../../../..');
const require = createRequire(path.join(repo, 'apps/studio/package.json'));
const puppeteer = require('puppeteer-core');

const chrome = process.env.SPOTLESS_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const pngDir = process.argv[2];

const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--allow-file-access-from-files', '--font-render-hinting=none'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(here, 'deck.html')).href, { waitUntil: 'networkidle0', timeout: 120000 });
  await page.waitForFunction('document.body.dataset.ready === "1"', { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  const broken = await page.evaluate(() => [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src));
  if (broken.length) throw new Error('broken images: ' + broken.join(', '));
  // Overflow report: elements that spill outside their slide.
  const spill = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.slide').forEach((s, i) => {
      const r = s.getBoundingClientRect();
      s.querySelectorAll('*').forEach(el => {
        const b = el.getBoundingClientRect();
        if (b.width && (b.right > r.right + 1 || b.bottom > r.bottom + 1)) out.push(`slide ${i + 1}: <${el.tagName.toLowerCase()} class="${el.className}"> ${Math.round(b.right - r.right)}px right, ${Math.round(b.bottom - r.bottom)}px down`);
      });
    });
    return out;
  });
  if (spill.length) console.log('OVERFLOW:\n' + spill.slice(0, 30).join('\n'));
  await page.pdf({ path: path.join(here, 'SparkleTeam-deck.pdf'), width: '1920px', height: '1080px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, preferCSSPageSize: true });
  console.log('wrote', path.join(here, 'SparkleTeam-deck.pdf'));
  if (pngDir) {
    fs.mkdirSync(pngDir, { recursive: true });
    const n = await page.$$eval('.slide', s => s.length);
    for (let i = 0; i < n; i++) {
      const el = (await page.$$('.slide'))[i];
      await el.screenshot({ path: path.join(pngDir, `slide-${String(i + 1).padStart(2, '0')}.png`) });
    }
    console.log('wrote', n, 'PNGs to', pngDir);
  }
} finally {
  await browser.close();
}
