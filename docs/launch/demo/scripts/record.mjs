// Record a URL in headed Chrome at 1920x1080 via CDP screencast.
// usage: node record.mjs <url> <outDir> [maxSeconds]   (touch <outDir>/STOP to end)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
const require = createRequire(new URL('../../../../../apps/studio/package.json', import.meta.url));
const puppeteer = require('puppeteer-core');
const [url, out, maxS = '900'] = process.argv.slice(2);
mkdirSync(`${out}/frames`, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: false, defaultViewport: { width: Number(process.env.VW ?? 1920), height: Number(process.env.VH ?? 1022), deviceScaleFactor: 1 },
  args: ['--window-size=1920,1180', '--window-position=0,0', '--no-first-run', '--no-default-browser-check', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', `--user-data-dir=${out}/profile`],
});
const page = (await browser.pages())[0];
const ZOOM = process.env.ZOOM ?? '0.72';
await page.evaluateOnNewDocument((z) => { document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.zoom = z; }); }, ZOOM);
await page.goto(url, { waitUntil: 'domcontentloaded' });
const cdp = await page.createCDPSession();
let n = 0; const t0 = Date.now();
cdp.on('Page.screencastFrame', async (f) => {
  const name = String(n++).padStart(6, '0');
  writeFileSync(`${out}/frames/${name}.jpg`, Buffer.from(f.data, 'base64'));
  appendFileSync(`${out}/frames.txt`, `${name} ${f.metadata.timestamp}\n`);
  await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 80, maxWidth: 1920, maxHeight: 1080, everyNthFrame: Number(process.env.NTH ?? 3) });
process.on('SIGTERM', async () => { await browser.close(); process.exit(0); });
while (!existsSync(`${out}/STOP`) && Date.now() - t0 < Number(maxS) * 1000) await new Promise((r) => setTimeout(r, 500));
await cdp.send('Page.stopScreencast').catch(() => {});
await browser.close();
console.log('frames', n);
