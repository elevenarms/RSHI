/**
 * The crew's command line: `pnpm --filter @spotless/crew crew <command>`.
 *
 *   smoke                     one baseline episode on a small train drill (fast tier)
 *   evolve [--generations 3] [--practice 3] [--validate 3] [--proposals 2] [--tier fast]
 *          [--concurrency 3] [--margin 0.03] [--exam] [--exam-tasks 3] [--dry]
 *   exam   [--tier fast|official] [--tasks 3] [--champion <genomeId>] [--dry]
 *   serve  [--run <id>]         serve a past run's events (replay) for the studio
 *   tasks                       list the suites
 *   memory                      print memory stats and lessons
 *
 * --dry (or CREW_FAKE=1) replaces every model with a fake that starts the cycle at once: the
 * control flow runs end to end with no spend.
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadEnvFile } from '@spotless/bench';
import type { CrewEvent, Genome, TaskSpec } from './contracts.ts';
import { CREW_PORT } from './contracts.ts';
import { EventBus, eventLine, readEvents } from './bus.ts';
import { defaultLoaderEffort, modelFor, setStreamSink, usageTotals } from './crusoe.ts';
import { emitMemory, evolve, MODELS } from './evolve.ts';
import { exam } from './exam.ts';
import { baselineGenome } from './genome.ts';
import { CrewMemory } from './memory/index.ts';
import { CONCURRENCY, closeGames, CREW_ROOT, ensureWebBuilt, gameFor, REPO_ROOT, runTask, type Tier } from './runner.ts';
import { startCrewServer } from './server.ts';
import { drill, testTasks, trainTasks } from './tasks.ts';

loadEnvFile();

function args(argv: string[]): { cmd: string; flags: Map<string, string> } {
  const flags = new Map<string, string>();
  const cmd = argv[0] ?? 'help';
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i] as string;
    if (!a.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) flags.set(a.slice(2), 'true');
    else {
      flags.set(a.slice(2), next);
      i++;
    }
  }
  return { cmd, flags };
}

const num = (flags: Map<string, string>, k: string, d: number): number => {
  const v = flags.get(k);
  return v === undefined ? d : Number(v);
};

const STUDIO_DIR = join(REPO_ROOT, 'apps', 'studio', 'dist');
const RUNS_DIR = join(CREW_ROOT, 'runs');

function newRun(mode: string): { runId: string; runDir: string; bus: EventBus } {
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}-${mode}`;
  const runDir = join(RUNS_DIR, runId);
  mkdirSync(runDir, { recursive: true });
  const bus = new EventBus(runId, runDir, (e: CrewEvent) => {
    const line = eventLine(e);
    if (line !== null) console.log(line);
  });
  setStreamSink((e) => bus.emit(e));
  return { runId, runDir, bus };
}

async function serve(bus: EventBus): Promise<void> {
  const port = Number(process.env['CREW_PORT'] ?? CREW_PORT);
  try {
    await startCrewServer({ port, bus, studioDir: STUDIO_DIR, runsDir: RUNS_DIR });
    console.log(`studio: http://127.0.0.1:${port}  (events: /api/events)`);
  } catch (error) {
    console.log(`could not serve on ${port}: ${String(error)}`);
  }
}

function printUsage(): void {
  console.log('\nTokens per model:');
  for (const [m, t] of usageTotals) console.log(`  ${m}: ${t.requests} req, ${t.in} in (${t.cached} cached), ${t.out} out, ${t.retries} retries`);
}

async function main(): Promise<void> {
  const { cmd, flags } = args(process.argv.slice(2));
  if (flags.get('dry') === 'true') process.env['CREW_FAKE'] = '1';
  const tier = (flags.get('tier') ?? 'fast') as Tier;
  const concurrency = num(flags, 'concurrency', CONCURRENCY);
  const loaderModel = modelFor('loader');
  const loaderEffort = defaultLoaderEffort(loaderModel);
  const memory = CrewMemory.open(process.env['CREW_MEMORY_DIR'] ?? join(CREW_ROOT, process.env['CREW_FAKE'] === '1' ? 'memory-dry' : 'memory'));

  if (cmd === 'tasks') {
    for (const t of [...trainTasks(4, 0), ...testTasks(3, 0)]) console.log(`${t.split}\t${t.id}\t${t.title}\t${t.itemCount} items\t${t.pointsAvailable} pts`);
    return;
  }
  if (cmd === 'memory') {
    console.log(JSON.stringify(memory.stats()));
    for (const l of memory.lessons().slice(0, 30)) console.log(`(${l.confidence.toFixed(2)} +${l.support}/-${l.contradict}) [${l.tags.join(',')}] ${l.text}`);
    return;
  }
  if (cmd === 'serve') {
    const run = flags.get('run') ?? (existsSync(RUNS_DIR) ? readdirSync(RUNS_DIR).sort().pop() : undefined);
    if (run === undefined) throw new Error('no runs');
    const bus = new EventBus(run, null);
    for (const e of readEvents(join(RUNS_DIR, run))) bus.events.push(e);
    console.log(`replaying ${run}: ${bus.events.length} events`);
    await serve(bus);
    return;
  }

  ensureWebBuilt((s) => console.log(s));
  if (cmd === 'smoke') {
    const { runId, runDir, bus } = newRun('smoke');
    await serve(bus);
    const task = flags.has('source') ? drill(flags.get('source') as string, num(flags, 'items', 12), num(flags, 'seed', 0), 'train') : (trainTasks(1, 0, num(flags, 'items', 8))[0] as TaskSpec);
    const genome = baselineGenome({ loader: loaderModel, loaderEffort });
    const game = await gameFor(tier, [task]);
    bus.emit({ type: 'run_started', mode: 'smoke', models: MODELS(loaderModel), trainTasks: [{ id: task.id, title: task.title, items: task.itemCount }], testTasks: [], generations: 0, gameUrl: game.url });
    bus.emit({ type: 'genome', genome, status: 'baseline' });
    const t0 = Date.now();
    const s = await runTask({ game, task, genome, memory, bus, purpose: 'smoke', tier, runId, runDir });
    console.log(JSON.stringify({ ...s, items: undefined }, null, 1));
    for (const i of s.items) console.log(`  ${i.itemId.padEnd(16)} ${i.kind.padEnd(30)} ${String(i.rack).padEnd(15)} ${String(i.stance).padEnd(18)} ${i.clean ? 'clean' : i.loaded ? 'DIRTY' : 'left out'}`);
    console.log(`smoke took ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    emitMemory(bus, memory);
    bus.emit({ type: 'phase', phase: 'done', generation: 0, detail: `smoke: ${s.points}/${s.pointsAvailable}` });
    printUsage();
    if (flags.get('keep') !== 'true') {
      await closeGames();
      process.exit(0);
    }
    return;
  }

  if (cmd === 'evolve' || cmd === 'exam') {
    const mode = cmd;
    const { runId, runDir, bus } = newRun(process.env['CREW_FAKE'] === '1' ? `${mode}-dry` : mode);
    await serve(bus);
    const generations = num(flags, 'generations', 3);
    const practice = num(flags, 'practice', 3);
    const validate = num(flags, 'validate', 3);
    const proposals = num(flags, 'proposals', 2);
    const examTasks = num(flags, mode === 'exam' ? 'tasks' : 'exam-tasks', 3);
    const withExam = mode === 'exam' || flags.get('exam') === 'true';
    const train = mode === 'evolve' ? [...trainTasks(practice, 0), ...Array.from({ length: generations }, (_, g) => trainTasks(validate, 1000 * (g + 1))).flat()] : [];
    const test = withExam ? testTasks(examTasks, 0) : [];
    const game = await gameFor(tier, [...train, ...test]);
    const baseline = baselineGenome({ loader: loaderModel, loaderEffort });
    bus.emit({ type: 'run_started', mode, models: MODELS(loaderModel), trainTasks: train.map((t) => ({ id: t.id, title: t.title, items: t.itemCount })), testTasks: test.map((t) => ({ id: t.id, title: t.title, items: t.itemCount })), generations: mode === 'evolve' ? generations : 0, gameUrl: game.url });
    emitMemory(bus, memory);
    const t0 = Date.now();
    let champion: Genome;
    if (mode === 'evolve') {
      champion = await evolve({ generations, practice, validate, proposals, tier, concurrency, margin: num(flags, 'margin', Number(process.env['CREW_MARGIN'] ?? '0.03')), runId, runDir, bus, memory, game, tasksFor: (count, seedBase) => trainTasks(count, seedBase) }, baseline);
      console.log(`evolution took ${((Date.now() - t0) / 60000).toFixed(1)} min; champion ${champion.id}`);
    } else {
      const wanted = flags.get('champion');
      const all = memory.genomes();
      champion = (wanted === undefined ? memory.champion() : all.find((g) => g.genome.id === wanted)?.genome ?? null) ?? baseline;
      bus.emit({ type: 'genome', genome: champion, status: 'champion' });
    }
    if (withExam) {
      const storedBaseline = mode === 'exam' ? (memory.genomes().find((g) => g.status === 'baseline')?.genome ?? baseline) : baseline;
      await exam({ baseline: storedBaseline, champion, tasks: test, game, tier, bus, memory, runId, runDir, concurrency });
      console.log(`report: ${join(runDir, 'report.md')}`);
    } else bus.emit({ type: 'phase', phase: 'done', generation: champion.generation, detail: `champion ${champion.id}` });
    printUsage();
    console.log(`total ${((Date.now() - t0) / 60000).toFixed(1)} min. Events stay served; Ctrl-C to quit.`);
    await closeGames();
    if (flags.get('exit') === 'true') process.exit(0);
    return;
  }
  console.log('commands: smoke | evolve | exam | serve | tasks | memory (see src/cli.ts)');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
