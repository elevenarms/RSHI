/**
 * The video's own game server: the same server as `tsx packages/server/src/cli.ts serve`
 * (open mode, no admin token, the built web client from apps/web/dist), plus the crew's drill
 * levels (`drill-<source>-<n>-s<seed>`), which the CLI does not offer and which the SparkleTeam
 * episode records name. Loopback only.
 *
 *   tsx scripts/game-server.ts [--port 8899] [--data .scratch/video-game] [--drills id,id,...]
 *
 * Without --drills it offers every drill named by an episode of the evolve run
 * (packages/crew/runs/2026-10-17T20-49-49-evolve/episodes). Prints `READY <url>` when listening.
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../../..');
const { buildServer } = await import(join(ROOT, 'packages/server/src/app.ts'));
const { allLevels } = await import(join(ROOT, 'packages/levels/src/index.ts'));
const { drill } = await import(join(ROOT, 'packages/crew/src/tasks.ts'));

const { values } = parseArgs({
  options: {
    port: { type: 'string', default: '8899' },
    data: { type: 'string', default: join(ROOT, '.scratch/video-game') },
    drills: { type: 'string' },
    run: { type: 'string', default: join(ROOT, 'packages/crew/runs/2026-10-17T20-49-49-evolve') },
  },
});

/** `drill-mixed-family-12-s3` → the level, rebuilt exactly as the crew built it. */
export function drillLevel(id: string): unknown {
  const m = /^drill-(.+)-(\d+)-s(\d+)$/.exec(id);
  if (m === null) throw new Error(`not a drill id: ${id}`);
  return drill(m[1] as string, Number(m[2]), Number(m[3]), 'train').level;
}

const ids = new Set<string>();
if (values.drills !== undefined) {
  for (const id of values.drills.split(',').filter(Boolean)) ids.add(id.trim());
} else if (existsSync(join(values.run, 'episodes'))) {
  for (const dir of readdirSync(join(values.run, 'episodes'))) {
    const id = dir.split('__')[0] ?? '';
    if (id.startsWith('drill-')) ids.add(id);
  }
}
const levels = [...allLevels(), ...[...ids].map(drillLevel)];
const dataDir = resolve(values.data);
mkdirSync(dataDir, { recursive: true });
const server = await buildServer({ dataDir, host: '127.0.0.1', levels });
await server.app.listen({ port: Number(values.port), host: '127.0.0.1' });
console.log(`READY http://127.0.0.1:${values.port} (${levels.length} levels, ${ids.size} drills)`);
const stop = (): void => {
  void server.close().finally(() => process.exit(0));
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
