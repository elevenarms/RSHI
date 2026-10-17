// Render excerpts of our source files as syntax-highlighted 1920x1080 PNGs (Chrome via puppeteer-core).
// usage (from repo root): node docs/crew/launch/demo/scripts/codeshots.mjs <outDir>
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const PYG = new URL('../../video/.venv/bin/pygmentize', import.meta.url).pathname;
const hl = (src, first) => execFileSync(PYG, ['-l', 'typescript', '-f', 'html', '-O', `nowrap,noclasses,style=friendly,linenos=inline,linenostart=${first}`], { input: src }).toString();
const require = createRequire(new URL('../../../../../apps/studio/package.json', import.meta.url));
const puppeteer = require('puppeteer-core');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const SHOTS = [
  ['contracts', 'packages/crew/src/contracts.ts', 34, 74, 'the genome: the team\'s whole configuration, typed'],
  ['genome', 'packages/crew/src/genome.ts', 123, 160, 'applyEdits: the Coach can only propose typed edits'],
  ['gatekeeper', 'packages/crew/src/gatekeeper.ts', 1, 60, 'the paired acceptance rule'],
  ['memory', 'packages/crew/src/memory/index.ts', 85, 125, 'memory: lessons carry a confidence'],
  ['loader', 'packages/crew/src/loader-policy.ts', 86, 125, 'the loader\'s tool proxy and preflight rule'],
  ['crusoe', 'packages/crew/src/crusoe.ts', 151, 200, 'Crusoe client: streaming + shared rate limiter'],
  ['water', 'apps/web/src/water.ts', 1, 40, 'cosmetic water FX for the wash'],
];
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, defaultViewport: { width: 1920, height: 1080 } });
const page = await browser.newPage();
for (const [key, file, a, b, cap] of SHOTS) {
  const lines = readFileSync(file, 'utf8').split('\n').slice(a - 1, b);
  const html = `<!doctype html><html><head><meta charset="utf-8">
<style>body{margin:0;background:#fff;font-family:'JetBrains Mono',monospace;color:#000}
.top{background:#000;color:#fff;font-size:15px;letter-spacing:.08em;padding:8px 28px;font-weight:600;display:flex;justify-content:space-between}
.hd{display:flex;align-items:center;gap:18px;padding:22px 48px 14px;border-bottom:1px solid #000}
.tag{background:#000;color:#fff;font-size:15px;font-weight:800;letter-spacing:.08em;padding:4px 10px}
.path{font-size:26px;font-weight:800}.cap{font-size:18px;color:#8A8A8A;margin-left:auto}
pre{margin:0;font-family:'JetBrains Mono',monospace;padding:18px 48px;font-size:${lines.length > 44 ? 17 : 19}px;line-height:1.42}
code.hljs{background:#fff;padding:0;font-family:'JetBrains Mono',monospace}
.ln{color:#bbb;display:inline-block;width:3.2em;user-select:none}</style></head><body>
<div class="top"><span>SPARKLETEAM // BUILT TODAY</span><span>${file}</span></div>
<div class="hd"><span class="tag">CODE</span><span class="path">${file.split('/').slice(-2).join('/')}</span><span class="cap">${esc(cap)}</span></div>
<pre>${hl(lines.join('\n'), a)}</pre>
</body></html>`;
  await page.setContent(html, { waitUntil: 'load' }); await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: `${out}/${key}.png` });
  console.log(key);
}
await browser.close();
