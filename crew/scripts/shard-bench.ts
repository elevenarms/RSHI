/**
 * Wash throughput through N shards: 4 drills played by the scripted `careful` loader (no model),
 * all at once, fast tier. Each configuration needs its own CREW_GAME_DIR (the wash cache lives there).
 *
 *   CREW_GAME_SHARDS=2 CREW_GAME_DIR=.crew/bench-2 tsx scripts/shard-bench.ts [count]
 */
import { join } from 'node:path';
import { runEpisode, scriptedPolicy } from '@spotless/bench';
import { closeGames, gameFor } from '../src/runner.ts';
import { trainTasks } from '../src/tasks.ts';

const count = Number(process.argv[2] ?? '4');
const tasks = trainTasks(count, 500, 12);
const pool = await gameFor('fast', tasks);
const t0 = performance.now();
const rows = await Promise.all(
  tasks.map(async (task) => {
    const shard = pool.acquire();
    const started = performance.now();
    let washFrom = 0;
    const r = await runEpisode({ game: shard.game, levelId: task.id, policy: scriptedPolicy('careful'), outDir: join(process.env['CREW_GAME_DIR'] ?? '.crew', 'bench-episodes'), verify: 'none', saveImages: false, log: (l) => { if (l.startsWith('wash ') && washFrom === 0) washFrom = performance.now(); } });
    pool.release(shard);
    return { task: task.id, shard: shard.index, points: `${r.record.score?.points}/${r.record.score?.points_available}`, loadS: ((washFrom - started) / 1000).toFixed(1), washWallS: r.record.time.wash_wall_s, untilDoneS: ((performance.now() - t0) / 1000).toFixed(1) };
  }),
);
console.table(rows);
console.log(`shards ${pool.shards.length}: ${count} episodes in ${((performance.now() - t0) / 1000).toFixed(1)} s`);
await closeGames();
process.exit(0);
