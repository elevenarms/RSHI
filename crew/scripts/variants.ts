/**
 * Genome variants on the held-out drills (test split): ablations of the champion's playbook, or the
 * champion and the baseline with other loader models. Exam purposes: memory keeps them apart.
 *
 *   CREW_MEMORY_DIR=<fork> CREW_GAME_SHARDS=4 tsx scripts/variants.ts <ablation|transfer> [tasks] [repeats]
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvFile } from '@spotless/bench';
import type { Genome } from '../src/contracts.ts';
import { EventBus, eventLine } from '../src/bus.ts';
import { setCallLog } from '../src/calllog.ts';
import { setRateLog, setStreamSink } from '../src/crusoe.ts';
import { isVisionModel } from '../src/genome.ts';
import { CrewMemory } from '../src/memory/index.ts';
import { closeGames, CONCURRENCY, CREW_ROOT, gameFor, pool, runTask } from '../src/runner.ts';
import { testTasks } from '../src/tasks.ts';

loadEnvFile();
const set = process.argv[2] ?? 'ablation';
const count = Number(process.argv[3] ?? '12');
const repeats = Number(process.argv[4] ?? '1');
const memory = CrewMemory.open(process.env['CREW_MEMORY_DIR'] as string);
const find = (id: string): Genome => {
  const g = memory.genomes().find((x) => x.genome.id === id)?.genome;
  if (g === undefined) throw new Error(`no genome ${id}`);
  return g;
};
const base = find(process.env['CREW_BASELINE'] ?? 'G0-fc671e');
const champ = find(process.env['CREW_CHAMPION'] ?? 'G2-704108');
const variant = (from: Genome, id: string, change: Partial<Genome>): Genome => ({ ...from, ...change, id, rationale: `variant: ${id}` });

let variants: Genome[] = [];
if (set === 'ablation') {
  for (const rule of champ.playbook) {
    variants.push(variant(base, `ABL-base+${rule.id}`, { playbook: [rule] }));
    variants.push(variant(champ, `ABL-champ-${rule.id}`, { playbook: champ.playbook.filter((r) => r.id !== rule.id) }));
  }
} else {
  const models = (process.env['CREW_TRANSFER_MODELS'] ?? 'deepseek-ai/Deepseek-V4-Flash=off,openai/gpt-oss-120b=low').split(',');
  for (const m of models) {
    const [model, effort] = m.split('=') as [string, string];
    const short = model.split('/').pop() as string;
    for (const [g, tag] of [[base, 'base'], [champ, 'champ']] as const) {
      variants.push(variant(g, `XFER-${tag}-${short}`, { loader: { ...g.loader, model, reasoningEffort: effort === 'default' ? null : effort, images: isVisionModel(model) } }));
    }
  }
}
if (process.env['CREW_VARIANTS'] !== undefined) variants = variants.filter((v) => (process.env['CREW_VARIANTS'] as string).split(',').some((x) => v.id.includes(x)));

const runId = `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${set}`;
const runDir = join(CREW_ROOT, 'runs', runId);
mkdirSync(runDir, { recursive: true });
setCallLog(join(runDir, 'calls.jsonl'));
const bus = new EventBus(runId, runDir, (e) => {
  const l = eventLine(e);
  if (l !== null && (e.type === 'episode_finished' || e.type === 'log')) console.log(l);
});
setStreamSink((e) => bus.emit(e));
setRateLog((l) => bus.log(l));
const tasks = testTasks(count, 0);
const game = await gameFor('fast', tasks);
bus.emit({ type: 'run_started', mode: 'exam', models: { loader: variants.map((v) => v.loader.model).join(' | ') }, trainTasks: [], testTasks: tasks.map((t) => ({ id: t.id, title: t.title, items: t.itemCount })), generations: 0, gameUrl: game.url });
for (const v of variants) bus.emit({ type: 'genome', genome: v, status: 'candidate' });
const jobs = Array.from({ length: repeats }, (_, r) => variants.flatMap((v) => tasks.map((task) => ({ v, task, r })))).flat();
const t0 = Date.now();
const results = await pool(jobs, CONCURRENCY, async (j) => {
  const s = await runTask({ game, task: j.task, genome: j.v, memory, bus, purpose: 'exam-champion', tier: 'fast', runId, runDir });
  return { variant: j.v.id, repeat: j.r, taskId: s.taskId, points: s.points, pointsAvailable: s.pointsAvailable, share: s.share, failed: s.failed, stopped: s.stopped, itemsLoaded: s.itemsLoaded, itemsClean: s.itemsClean, turns: s.turns };
});
writeFileSync(join(runDir, 'variants.json'), `${JSON.stringify({ set, variants: variants.map((v) => ({ id: v.id, playbook: v.playbook.map((r) => r.id), loader: v.loader })), results }, null, 1)}\n`);
console.log(`${results.length} episodes in ${((Date.now() - t0) / 60000).toFixed(1)} min -> ${runDir}`);
await closeGames();
process.exit(0);
