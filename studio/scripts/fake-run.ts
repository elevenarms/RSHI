/**
 * A fake crew server for developing the studio: port 8791 (the real crew server uses 8790).
 *
 *   tsx scripts/fake-run.ts [--port 8791] [--speed 1] [--loop]
 *
 *  - `/api/events`      SSE: every event emitted so far, then the live ones (`data: <json>\n\n`).
 *  - `/api/events.json` the events emitted so far, as a JSON array.
 *  - `/fake/run.jsonl`  the whole simulated run (for `?replay=fake/run.jsonl&speed=4&t=60`).
 *  - `/fake/watch.html` a placeholder for the game's watch page.
 *  - everything else:   studio/dist (if built).
 */

import { createServer, type ServerResponse } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CrewEvent } from '@spotless/crew/contracts';
import { fakeRun } from './fake-events.ts';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', 'dist');
const args = process.argv.slice(2);
const opt = (name: string, def: string): string => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1]! : def;
};
const port = Number(opt('port', '8791'));
const speed = Number(opt('speed', '1'));
const loop = args.includes('--loop');
const watchBase = `http://127.0.0.1:${port}/fake/watch.html`;
const placeholder = readFileSync(join(here, 'watch.html'), 'utf8');

let emitted: CrewEvent[] = [];
const clients = new Set<ServerResponse>();
let full: CrewEvent[] = [];

function startRun(n: number): void {
  const start = new Date();
  // Event times are compressed by the speed so the timestamps match what the clients see.
  const raw = fakeRun({ runId: `fake-${start.toISOString().slice(0, 19).replace(/[:T]/g, '')}-${n}`, start, watchBase });
  const t0 = start.getTime();
  full = raw.map((e) => ({ ...e, at: new Date(t0 + (Date.parse(e.at) - t0) / speed).toISOString() }));
  emitted = [];
  let i = 0;
  const tick = (): void => {
    const now = Date.now();
    while (i < full.length && Date.parse(full[i]!.at) <= now) {
      const e = full[i++]!;
      emitted.push(e);
      const line = `data: ${JSON.stringify(e)}\n\n`;
      for (const c of clients) c.write(line);
    }
    if (i < full.length) setTimeout(tick, 20);
    else if (loop) setTimeout(() => startRun(n + 1), 20000);
    else console.log('fake run complete (server stays up)');
  };
  tick();
}

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://x');
  const p = url.pathname;
  if (p === '/api/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' });
    for (const e of emitted) res.write(`data: ${JSON.stringify(e)}\n\n`);
    clients.add(res);
    const ka = setInterval(() => res.write(': keep-alive\n\n'), 15000);
    req.on('close', () => { clients.delete(res); clearInterval(ka); });
    return;
  }
  if (p === '/api/events.json') {
    res.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    res.end(JSON.stringify(emitted));
    return;
  }
  if (p === '/fake/run.jsonl') {
    const ev = fakeRun({ watchBase });
    res.writeHead(200, { 'content-type': 'application/x-ndjson', 'access-control-allow-origin': '*' });
    res.end(ev.map((e) => JSON.stringify(e)).join('\n') + '\n');
    return;
  }
  if (p === '/fake/watch.html') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(placeholder);
    return;
  }
  const file = normalize(join(dist, p === '/' ? 'index.html' : p));
  if (file.startsWith(dist) && existsSync(file) && statSync(file).isFile()) {
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
    return;
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end(existsSync(dist) ? 'not found' : 'not found (run `pnpm --filter @spotless/studio build` to serve the studio here)');
}).listen(port, '127.0.0.1', () => {
  console.log(`fake crew server on http://127.0.0.1:${port}  (speed ×${speed}${loop ? ', loop' : ''})`);
  startRun(1);
});
