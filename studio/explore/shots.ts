/**
 * Screenshots of the sandbox at 1920×1080 (vite must be serving it on port 5175).
 *   tsx studio/explore/shots.ts [variant ...]      e.g. `1 2 3`
 * Writes studio/screenshots/explore-v<variant>-<moment>.png.
 */
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'screenshots');
mkdirSync(out, { recursive: true });
const base = process.env['EXPLORE_URL'] ?? 'http://127.0.0.1:5175/';
const chrome = process.env['SPOTLESS_CHROME'] ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const args = process.argv.slice(2);
const variants = args.filter((a) => /^\d$/.test(a));
const only = args.filter((a) => !/^\d$/.test(a));
const MOMENTS: [string, string][] = [
  ['episode', 'at=episode&dt=9'],
  ['critique', 'at=critique&dt=3'],
  ['memory', 'at=memory&dt=1.5'],
  ['proposal', 'at=proposal&dt=3'],
  ['evaluate', 'at=proposal&dt=9.2'],
  ['verdict', 'at=verdict&dt=0.5'],
  ['rejected', 'at=verdict2&dt=0.5'],
  ['exam', 'at=examResult&dt=1.5'],
  ['title', 'card=title&at=episode&dt=2'],
  ['outro', 'card=outro&at=episode&dt=2'],
];

const browser = await launch({ executablePath: chrome, headless: true, args: ['--window-size=1920,1080', '--hide-scrollbars'], defaultViewport: { width: 1920, height: 1080 } });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror', e));
for (const v of variants.length ? variants : ['1', '2', '3']) {
  for (const [name, qs] of MOMENTS) {
    if (only.length && !only.includes(name)) continue;
    await page.goto(`${base}?v=${v}&${qs}&paused&nohelp`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, name === 'verdict' || name === 'rejected' ? 900 : 2200));
    const file = join(out, `explore-v${v}-${name}.png`);
    await page.screenshot({ path: file });
    console.log(file);
  }
}
await browser.close();
