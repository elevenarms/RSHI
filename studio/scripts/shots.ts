/**
 * Screenshots of the studio at moments of the fake run (fake server must be up on 8791 and
 * dist built): `tsx scripts/shots.ts [--size 1920x1080]` → screenshots/*.png.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch } from 'puppeteer-core';
import { fakeRun } from './fake-events.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'screenshots');
const size = (process.argv.includes('--size') ? process.argv[process.argv.indexOf('--size') + 1]! : '1920x1080').split('x').map(Number);
const chrome = process.env['SPOTLESS_CHROME'] ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
if (!existsSync(chrome)) throw new Error(`Chrome not found at ${chrome}; set SPOTLESS_CHROME`);

const ev = fakeRun();
const t0 = Date.parse(ev[0]!.at);
const sec = (pred: (e: (typeof ev)[number]) => boolean): number => (Date.parse(ev.find(pred)!.at) - t0) / 1000;
const moments: [string, number, number][] = [
  ['1-practice', sec((e) => e.type === 'phase' && e.phase === 'practice') + 14, 3000],
  ['2-review', sec((e) => e.type === 'phase' && e.phase === 'review') + 4, 2500],
  ['3-decision', sec((e) => e.type === 'decision') - 2, 3000],
  ['4-exam-live', sec((e) => e.type === 'phase' && e.phase === 'exam') + 12, 2500],
  ['5-exam', sec((e) => e.type === 'exam') - 1, 4500],
  ['6-done', sec((e) => e.type === 'phase' && e.phase === 'done') + 30, 1500],
];
const browser = await launch({ executablePath: chrome, headless: true, args: [`--window-size=${size[0]},${size[1]}`, '--mute-audio'], defaultViewport: { width: size[0]!, height: size[1]!, deviceScaleFactor: 1 } });
try {
  for (const [name, t, wait] of moments) {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:8791/?replay=fake/run.jsonl&speed=1&t=${t.toFixed(1)}`, { waitUntil: 'networkidle2' });
    await new Promise((r) => setTimeout(r, wait));
    const file = join(out, `${name}${size[0] === 1920 ? '' : `-${size[0]}`}.png`);
    await page.screenshot({ path: file as `${string}.png` });
    console.log(file);
    await page.close();
  }
} finally {
  await browser.close();
}
