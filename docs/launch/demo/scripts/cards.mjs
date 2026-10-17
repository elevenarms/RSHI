// Title/result cards (opaque 1920x1080) and overlays (transparent PNGs): lower thirds, tags, captions.
// usage (from repo root): node docs/crew/launch/demo/scripts/cards.mjs <outDir>
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
const require = createRequire(new URL('../../../../../apps/studio/package.json', import.meta.url));
const puppeteer = require('puppeteer-core');
const out = process.argv[2]; mkdirSync(out, { recursive: true });
const here = new URL('..', import.meta.url).pathname;
const CSS = `*{box-sizing:border-box}body{margin:0;width:1920px;height:1080px;font-family:'JetBrains Mono',monospace;color:#000}
.top{position:absolute;top:0;left:0;right:0;background:#000;color:#fff;font-size:16px;letter-spacing:.08em;padding:9px 40px;font-weight:600;display:flex;justify-content:space-between}
.tag{display:inline-block;background:#000;color:#fff;font-weight:800;letter-spacing:.08em;font-size:20px;padding:6px 14px}
.wrap{position:absolute;left:140px;right:140px;top:200px}
h1{font-size:150px;font-weight:800;margin:0;letter-spacing:-.02em}
.sub{font-size:38px;line-height:1.35;margin-top:30px;max-width:1500px}
.small{font-size:22px;color:#8A8A8A;letter-spacing:.08em;margin-top:40px;text-transform:uppercase}
.big{font-size:120px;font-weight:800;line-height:1}
.g{color:#0A9D58}.r{color:#D64545}.a{color:#E6A100}.gr{color:#8A8A8A}
.rule{border-top:1px solid #000;margin:34px 0}
.hl{font-size:56px;font-weight:800;line-height:1.15;margin-top:26px}
.foot{font-size:24px;color:#8A8A8A;margin-top:30px;line-height:1.5}`;
const banner = (r = 'DISHWASHING SCIENCE DIVISION') => `<div class="top"><span>SPARKLETEAM // ${r}</span><span>CEREBRAL VALLEY × CRUSOE · 17 OCT 2026</span></div>`;
const cards = {
  title: `${banner()}<div class="wrap" style="top:300px"><span class="tag">DEMO · 60 S</span><h1>SPARKLETEAM</h1>
    <div class="sub">a self-improving team of open Nemotron models,<br>built today at the Cerebral Valley × Crusoe hackathon</div>
    <div class="small">5 roles · NVIDIA Nemotron on Crusoe · DishwasherBench by Composo</div></div>`,
  f1: `${banner()}<div class="wrap"><span class="tag">FINDING 1 · PHYSICS</span><div class="hl">A cup stood mouth up keeps half its grime.</div><div class="rule"></div>
    <div style="display:flex;gap:160px"><div><div class="small" style="margin:0 0 12px">mouth up</div><div class="big r">0/11</div><div class="foot">clean · 49% soil left · 224 ml retained</div></div>
    <div><div class="small" style="margin:0 0 12px">mouth down</div><div class="big g">26/26</div><div class="foot">clean · 0% soil · 0 ml</div></div></div>
    <div class="foot">drinkware and ramekins washed alone · deterministic sim · +60 pp P(clean), CI 33–87</div></div>`,
  sup: `${banner()}<div class="wrap"><span class="tag">FINDING 2 · LEARNED SUPERSTITION</span><div class="hl">It learned a superstition,<br>and we caught it.</div><div class="rule"></div>
    <div class="sub" style="font-size:32px">Rule R1.1 “no cereal bowl mouth-down at 45°” rested on <b>1 failure in 2 loads</b>.<br>The controlled sweep washed every mouth-down bowl clean, 45° included.</div>
    <div class="foot">R2.1 “glasses mouth down” was real physics. The Gatekeeper could not tell the two apart.</div></div>`,
  null: `${banner()}<div class="wrap"><span class="tag" style="background:#E6A100;color:#000">REPLICATION · 12 HELD-OUT DRILLS × 2</span><div class="hl">The +17.8 pp exam gain did not replicate.</div><div class="rule"></div>
    <div style="display:flex;gap:120px;align-items:flex-end"><div><div class="small" style="margin:0 0 12px">Δ champion vs baseline</div><div class="big">−0.3 pp</div></div>
    <div class="foot" style="margin:0 0 10px">95% CI −13 to +12 · 23 valid pairs<br>12 wins / 9 losses / 2 ties · sign test p = 0.66<br>cause: the weak loader's sampling noise (SD ≈ 0.3 per drill)</div></div></div>`,
  next: `${banner()}<div class="wrap"><span class="tag">NEXT · PROPOSED, NOT A RESULT</span><div class="hl">Fine-tune the noisy loader.</div><div class="rule"></div>
    <div class="sub" style="font-size:32px">LoRA SFT of Nemotron 3.5 Lightning on the team's best trajectories,<br>straight from the token-level call logs, on Crusoe Serverless Fine-Tuning.</div>
    <div class="foot">Goal: lower variance, so the Gatekeeper's paired test can resolve real gains and stop accepting superstitions.</div></div>`,
  links: `${banner()}<div class="wrap" style="top:330px"><h1 style="font-size:110px">SPARKLETEAM</h1><div class="rule"></div>
    <div class="sub" style="font-size:46px;font-weight:600">elevenarms.github.io/RSHI<br>github.com/elevenarms/RSHI</div>
    <div class="small">NVIDIA Nemotron · Crusoe · DishwasherBench by Composo</div></div>`,
};
const lt = (n, t) => `<div style="position:absolute;left:40px;top:${process.env.LTY ?? 862}px;display:flex;align-items:stretch;box-shadow:0 2px 0 #000">
  <div style="background:#000;color:#fff;font-weight:800;font-size:24px;padding:14px 18px;letter-spacing:.08em">${n}</div>
  <div style="background:#fff;border:2px solid #000;font-weight:800;font-size:34px;padding:9px 22px">${t}</div></div>`;
const LTS = ['5 Nemotron models on Crusoe', 'weak loader plays a real physics sim', 'every token streamed', 'Critic writes lessons → memory', "Coach rewrites the team's own genome", 'Gatekeeper: keep only measured gains', 'cosmetic water FX · apps/web/src/water.ts'];
const tag = (t, bg = '#D64545') => `<div style="position:absolute;right:30px;top:34px;background:${bg};color:#fff;font-weight:800;font-size:22px;letter-spacing:.08em;padding:8px 14px">● ${t}</div>`;
const TAGS = { live4: 'LIVE RECORDING · ×4', live1: 'LIVE RECORDING · ×1', live2: 'LIVE RECORDING · ×2', live8: 'LIVE RECORDING · ×8', replay8: 'STUDIO REPLAY OF A REAL RUN · ×8', replay16: 'STUDIO REPLAY OF A REAL RUN · ×16', code: 'BUILT TODAY: packages/crew · apps/studio · water FX' };
const cap = (t) => `<div style="position:absolute;left:0;right:0;top:1026px;text-align:center"><span style="background:#000;color:#fff;font-size:25px;padding:7px 16px;line-height:1.6">${t}</span></div>`;
const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, defaultViewport: { width: 1920, height: 1080 } });
const page = await browser.newPage();
const shot = async (name, body, transparent) => {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}body{background:${transparent ? 'transparent' : '#fff'}}</style></head><body>${body}</body></html>`, { waitUntil: 'load' });
  await page.screenshot({ path: `${out}/${name}.png`, omitBackground: transparent });
};
for (const [k, b] of Object.entries(cards)) await shot(`card-${k}`, b, false);
for (const [i, t] of LTS.entries()) await shot(`lt-${i}`, lt(String(i + 1).padStart(2, '0'), t), true);
for (const [k, t] of Object.entries(TAGS)) await shot(`tag-${k}`, tag(t, k === 'code' ? '#000' : k.startsWith('replay') ? '#E6A100' : '#D64545'), true);
const caps = JSON.parse(readFileSync(`${here}vo/captions.json`, 'utf8'));
for (const [i, c] of caps.entries()) await shot(`cap-${i}`, cap(c.text), true);
await browser.close();
console.log('ok');
