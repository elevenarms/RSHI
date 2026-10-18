/**
 * The crew's HTTP server (node:http): `/api/events` (SSE: every past event of the run, then live),
 * `/api/events.json`, `/api/runs`, and the studio's built files (studio/dist, SPA fallback).
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize } from 'node:path';
import type { CrewEvent } from './contracts.ts';
import type { EventBus } from './bus.ts';
import { ARCHIVE_ROOT } from './archive.ts';

const TYPES: { [ext: string]: string } = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
};

export interface CrewServerOptions {
  readonly port: number;
  readonly bus: EventBus;
  readonly studioDir: string;
  readonly runsDir: string;
}

export function startCrewServer(o: CrewServerOptions): Promise<Server> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    res.setHeader('access-control-allow-origin', '*');
    if (url.pathname === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      const send = (e: CrewEvent): void => {
        res.write(`data: ${JSON.stringify(e)}\n\n`);
      };
      // ?streams=0 skips the past token stream (it can be large); live tokens still come.
      const pastStreams = url.searchParams.get('streams') !== '0';
      for (const e of o.bus.events) if (pastStreams || e.type !== 'stream') send(e);
      const off = o.bus.subscribe(send);
      const beat = setInterval(() => res.write(': heartbeat\n\n'), 15_000);
      req.on('close', () => {
        off();
        clearInterval(beat);
      });
      return;
    }
    if (url.pathname === '/api/events.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(o.bus.events));
      return;
    }
    if (url.pathname === '/api/runs') {
      const list = (dir: string, archived: boolean) =>
        existsSync(dir)
          ? readdirSync(dir)
              .filter((d) => !d.startsWith('.') && (existsSync(join(dir, d, 'events.jsonl')) || existsSync(join(dir, d, 'events.jsonl.gz')) || existsSync(join(dir, d, 'manifest.json'))))
              .map((d) => ({ runId: d, archived, updatedAt: statSync(join(dir, d)).mtime.toISOString() }))
          : [];
      const live = list(o.runsDir, false);
      const runs = [...live, ...list(ARCHIVE_ROOT, true).filter((r) => !live.some((l) => l.runId === r.runId))].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ current: o.bus.runId, runs }));
      return;
    }
    // Static studio.
    if (!existsSync(join(o.studioDir, 'index.html'))) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><title>Crew</title><p>The studio is not built. Run <code>pnpm --filter @spotless/studio build</code>. Events: <a href="/api/events.json">/api/events.json</a></p>');
      return;
    }
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    let file = join(o.studioDir, rel);
    if (!file.startsWith(o.studioDir) || !existsSync(file) || statSync(file).isDirectory()) file = join(o.studioDir, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(o.port, '127.0.0.1', () => resolve(server));
  });
}
