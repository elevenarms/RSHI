import { launch } from 'puppeteer-core';
const [w, h] = process.argv[3]!.split('x').map(Number);
const b = await launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: [`--window-size=${w},${h}`, '--mute-audio'], defaultViewport: { width: w!, height: h! } });
const p = await b.newPage();
await p.goto(process.argv[4] ?? 'http://127.0.0.1:8790/', { waitUntil: 'domcontentloaded' });
await new Promise((r) => setTimeout(r, 10000));
await p.screenshot({ path: process.argv[2] as `${string}.png` });
await b.close();
