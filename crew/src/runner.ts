/**
 * Running tasks: one game server per wash tier, one episode per task, summarised item by item and
 * recorded in memory (exam episodes are held out by memory itself).
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import type { HarnessGame } from '@spotless/bench';
import { connectGame, runEpisode, startGame } from '@spotless/bench';
import { getItemType } from '@spotless/catalogue';
import type { Level } from '@spotless/levels';
import { DEFAULT_STATIC_DIR } from '@spotless/server';
import type { CrewMemoryApi, EpisodePurpose, EpisodeSummary, Genome, ItemOutcome, TaskSpec } from './contracts.ts';
import type { EventBus } from './bus.ts';
import { loaderProvider } from './crusoe.ts';
import { crewLoaderPolicy, type LoaderTrace } from './loader-policy.ts';
import { stanceOf } from './stance.ts';
import { taskCard } from './tasks.ts';
import { makePlan } from './team/planner.ts';
import { librarianBrief } from './team/librarian.ts';

export type Tier = 'fast' | 'official';

export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const CREW_ROOT = join(REPO_ROOT, '.crew');

/** apps/web/dist must exist: the game server serves the watch page from it. */
export function ensureWebBuilt(log: (s: string) => void): void {
  if (existsSync(join(DEFAULT_STATIC_DIR, 'index.html'))) return;
  log('building apps/web (the watch page) ...');
  execSync('pnpm --filter @spotless/web build', { cwd: REPO_ROOT, stdio: 'inherit' });
}

/** One game server of a pool, with what it is doing now. */
export interface Shard {
  readonly index: number;
  readonly game: HarnessGame;
  episodes: number;
  washing: number;
}

/**
 * The game servers of a tier: CREW_GAME_SHARDS of them (default 1), each with its own data
 * directory (.crew/game-<tier>-<i>; the first keeps .crew/game-<tier>) and port, all offering the
 * same levels. A server washes one load at a time, so shards wash in parallel. With
 * CREW_SHARD_GPU_ENV (a template such as `CUDA_VISIBLE_DEVICES={i}`) each shard runs in a process
 * of its own whose environment its wash workers inherit.
 */
export class GamePool {
  constructor(readonly shards: readonly Shard[]) {}
  /** Address of the first shard (for run_started). */
  get url(): string {
    return (this.shards[0] as Shard).game.url;
  }
  /** The least busy shard (fewest episodes plus washes), booked for one episode. */
  acquire(): Shard {
    const shard = [...this.shards].sort((a, b) => a.episodes + a.washing - (b.episodes + b.washing) || a.index - b.index)[0] as Shard;
    shard.episodes += 1;
    return shard;
  }
  release(shard: Shard): void {
    shard.episodes = Math.max(0, shard.episodes - 1);
  }
  async close(): Promise<void> {
    for (const s of this.shards) await s.game.close().catch(() => undefined);
  }
}

const pools = new Map<string, Promise<GamePool>>();
const children: ChildProcess[] = [];

function shardEnv(i: number): { [k: string]: string } {
  const template = process.env['CREW_SHARD_GPU_ENV'] ?? '';
  const out: { [k: string]: string } = {};
  for (const pair of template.split(/[\s,;]+/).filter((x) => x.includes('='))) {
    const [k, ...v] = pair.split('=');
    out[k as string] = v.join('=').replaceAll('{i}', String(i));
  }
  return out;
}

async function startShardProcess(i: number, tier: Tier, levels: readonly Level[], dataDir: string): Promise<HarnessGame> {
  const dir = join(dataDir, '..');
  mkdirSync(dataDir, { recursive: true });
  const levelsFile = join(dir, `shard-${tier}-${i}-levels.json`);
  writeFileSync(levelsFile, JSON.stringify(levels));
  const token = randomUUID();
  const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./shard.ts', import.meta.url)), levelsFile, dataDir, tier, token], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    env: { ...process.env, ...shardEnv(i) },
    stdio: ['pipe', 'pipe', 'inherit'],
  });
  children.push(child);
  const url = await new Promise<string>((resolve, reject) => {
    let buf = '';
    child.stdout?.on('data', (d: Buffer) => {
      buf += d.toString();
      const m = /SHARD (\{.*\})/.exec(buf);
      if (m !== null) resolve((JSON.parse(m[1] as string) as { url: string }).url);
    });
    child.once('exit', (code) => reject(new Error(`shard ${i} exited (${code})`)));
  });
  const game = connectGame(url, token, levels);
  return { ...game, close: async () => { child.stdin?.end(); } };
}

/** The game servers of a tier (started once per process), offering every task. */
export function gameFor(tier: Tier, tasks: readonly TaskSpec[]): Promise<GamePool> {
  const key = `${tier}:${tasks.map((t) => t.id).sort().join(',')}`;
  let p = pools.get(key);
  if (p === undefined) {
    const n = Math.max(1, Number(process.env['CREW_GAME_SHARDS'] ?? '1'));
    const levels = tasks.map((t) => t.level as Level);
    const root = process.env['CREW_GAME_DIR'] ?? CREW_ROOT;
    const separate = (process.env['CREW_SHARD_GPU_ENV'] ?? '') !== '';
    p = Promise.all(
      Array.from({ length: n }, async (_, i): Promise<Shard> => {
        const dataDir = join(root, i === 0 ? `game-${tier}` : `game-${tier}-${i}`);
        const game = separate
          ? await startShardProcess(i, tier, levels, dataDir)
          : await startGame({ dataDir, washTier: tier, render: true, levels, server: { staticDir: DEFAULT_STATIC_DIR } });
        return { index: i, game, episodes: 0, washing: 0 };
      }),
    ).then((shards) => new GamePool(shards));
    pools.set(key, p);
  }
  return p;
}

export async function closeGames(): Promise<void> {
  for (const p of pools.values()) await (await p).close();
  pools.clear();
  for (const c of children) c.stdin?.end();
}

/** A simple pool: at most `n` at once. */
export async function pool<T, R>(items: readonly T[], n: number, work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await work(items[i] as T, i);
    }
  });
  await Promise.all(workers);
  return out;
}

export const CONCURRENCY = Number(process.env['CREW_CONCURRENCY'] ?? '3');

let episodeSeq = 0;

function labelOf(kind: string): { label?: string } {
  try {
    return { label: getItemType(kind).name };
  } catch {
    return {};
  }
}

/** Final pictures of each episode's load (episodeKey -> PNGs), for the Critic; dropped once reviewed. */
export const finalImages = new Map<string, string[]>();

export interface RunTaskOptions {
  readonly game: GamePool;
  readonly task: TaskSpec;
  readonly genome: Genome;
  readonly memory: CrewMemoryApi | null;
  readonly bus: EventBus | null;
  readonly purpose: EpisodePurpose;
  readonly tier: Tier;
  readonly runId: string;
  readonly runDir: string;
}

/** The episode summary from a record. */
export function summarise(o: { record: any; task: TaskSpec; genome: Genome; purpose: EpisodePurpose; tier: Tier; runId: string; episodeKey: string; trace: LoaderTrace | null; plan: string | null; recordPath: string | null; failedReason?: string }): EpisodeSummary {
  const level = o.task.level as Level;
  const r = o.record;
  const reportItems = new Map<string, any>((r?.report?.items ?? []).map((i: any) => [i.item_id, i]));
  const poses = new Map<string, any>((r?.load?.items ?? []).map((i: any) => [i.item_id, i]));
  const lastFrame = new Map<string, string>();
  for (const e of r?.events ?? []) {
    if (e.kind === 'action' && e.name === 'place' && e.accepted && typeof e.args?.item_id === 'string') lastFrame.set(e.args.item_id, String(e.args.frame ?? ''));
    if (e.kind === 'action' && e.name === 'remove' && e.accepted && typeof e.args?.item_id === 'string') lastFrame.delete(e.args.item_id);
  }
  const floor = new Set<string>((r?.prechecks?.on_tub_floor ?? []).map((x: any) => (typeof x === 'string' ? x : x?.item_id)));
  const items: ItemOutcome[] = level.items.map((item) => {
    const rep = reportItems.get(item.id);
    const pose = poses.get(item.id);
    const loaded = rep?.loaded === true || pose !== undefined;
    let rack: string | null = null;
    if (loaded) {
      rack = floor.has(item.id) ? 'tub_floor' : lastFrame.get(item.id) === 'cutlery_basket' ? 'cutlery_basket' : (o.trace?.locations.get(item.id) ?? lastFrame.get(item.id) ?? null);
      if ((rack === null || rack === 'unknown') && pose !== undefined) rack = (pose.position_mm?.[2] ?? 0) > 330 ? 'upper_rack' : 'lower_rack';
    }
    const q = pose?.quat_wxyz ?? null;
    return {
      itemId: item.id,
      kind: item.itemType,
      soils: item.soils.map((s) => s.type),
      points: item.points,
      loaded,
      clean: rep?.clean === true,
      rack,
      stance: loaded ? stanceOf(item.itemType, q) : null,
      position_mm: pose?.position_mm ?? null,
      quat_wxyz: q,
      holdsWater: rep?.holds_water === true,
      retainedWaterMl: Number(rep?.retained_water_ml ?? 0),
      movedDuringWash: rep?.moved_during_wash === true,
      residueRegions: rep?.residue_regions ?? [],
      residualFractionArea: Number(rep?.residual_fraction_area ?? 0),
    };
  });
  const points = Number(r?.score?.points ?? 0);
  const available = o.task.pointsAvailable;
  const usage = r?.agent?.usage ?? {};
  const byKind = (kind: string): number => (r?.events ?? []).filter((e: any) => e.kind === kind).length;
  const failed = o.failedReason !== undefined || r?.score == null;
  return {
    episodeKey: o.episodeKey,
    runId: o.runId,
    taskId: o.task.id,
    split: o.task.split,
    sourceLevelId: o.task.sourceLevelId,
    genomeId: o.genome.id,
    purpose: o.purpose,
    sessionId: r?.episode_id ?? null,
    tier: o.tier,
    points,
    pointsAvailable: available,
    share: available > 0 ? points / available : 0,
    itemsOffered: level.items.length,
    itemsLoaded: items.filter((i) => i.loaded).length,
    itemsClean: items.filter((i) => i.clean).length,
    items,
    stopped: o.failedReason ?? String(r?.agent?.stopped ?? 'unknown'),
    failed,
    turns: Number(r?.agent?.turns ?? 0),
    actions: byKind('action'),
    queries: byKind('query'),
    rejectedCalls: (r?.events ?? []).filter((e: any) => e.accepted === false).length,
    tokensIn: Number(usage.input_tokens ?? 0) + Number(usage.cache_read_input_tokens ?? 0) + Number(usage.cache_creation_input_tokens ?? 0),
    tokensOut: Number(usage.output_tokens ?? 0),
    cachedTokens: Number(usage.cache_read_input_tokens ?? 0),
    loadingS: Number(r?.time?.loading_s ?? 0),
    washS: Number(r?.time?.wash_wall_s ?? 0),
    plan: o.plan,
    loaderNotes: o.trace?.notes.slice(-5) ?? [],
    recordPath: o.recordPath,
    finishedAt: new Date().toISOString(),
  };
}

/** Plays one task with one genome and records it. */
export async function runTask(o: RunTaskOptions): Promise<EpisodeSummary> {
  const { bus, genome, task } = o;
  episodeSeq += 1;
  const episodeKey = `${o.purpose}-${genome.id}-${task.id}-${episodeSeq}`;
  const level = task.level as Level;
  let brief: string | null = null;
  if (genome.team.useMemoryBrief && o.memory !== null) {
    brief = await librarianBrief({ memory: o.memory, card: taskCard(task), maxLessons: genome.team.briefLessons, bus, to: genome.team.usePlanner ? 'planner' : 'loader', title: `Brief for ${task.title}`, episodeKey });
  }
  const plan = genome.team.usePlanner ? await makePlan({ genome, level, brief, bus, episodeKey }) : null;
  const provider = loaderProvider({ model: genome.loader.model, reasoningEffort: genome.loader.reasoningEffort, episodeKey });
  const { policy, trace } = crewLoaderPolicy({ genome, plan, brief: genome.team.usePlanner ? null : brief, provider, bus, episodeKey });
  const outDir = join(o.runDir, 'episodes');
  mkdirSync(outDir, { recursive: true });
  let washSaid = false;
  const shard = o.game.acquire();
  const log = (line: string): void => {
    const m = /^episode ([0-9a-f-]{36}):/.exec(line);
    if (m !== null) {
      const sessionId = m[1] as string;
      bus?.emit({ type: 'episode_started', episodeKey, sessionId, watchUrl: `${shard.game.url}/#${sessionId}&watch`, taskId: task.id, taskTitle: task.title, genomeId: genome.id, purpose: o.purpose, pointsAvailable: task.pointsAvailable, itemCount: task.itemCount, items: level.items.map((i) => ({ itemId: i.id, kind: i.itemType, soils: i.soils.map((s) => s.type), points: i.points, ...labelOf(i.itemType) })) });
      bus?.emit({ type: 'agent_status', role: 'loader', status: 'acting', label: `loading ${task.title}`, episodeKey });
    } else if (line.startsWith('wash ') && !washSaid) {
      washSaid = true;
      shard.washing += 1;
      bus?.emit({ type: 'wash', episodeKey, status: 'started', detail: `${line}${o.game.shards.length > 1 ? ` (shard ${shard.index})` : ''}` });
      bus?.emit({ type: 'agent_status', role: 'loader', status: 'idle', label: 'washing', episodeKey });
    }
  };
  let summary: EpisodeSummary;
  try {
    const result = await runEpisode({ game: shard.game, levelId: task.id, policy, seed: 1, outDir, verify: 'none', saveImages: false, log });
    summary = summarise({ record: result.record, task, genome, purpose: o.purpose, tier: o.tier, runId: o.runId, episodeKey, trace, plan, recordPath: result.file });
    const washFailed = result.record.wash?.status === 'failed' || result.record.score === null;
    bus?.emit({ type: 'wash', episodeKey, status: washFailed ? 'failed' : 'done', detail: washFailed ? summary.stopped : `${summary.points}/${summary.pointsAvailable} points` });
  } catch (error) {
    bus?.log(`episode ${episodeKey} failed: ${String(error)}`, 'error');
    summary = summarise({ record: null, task, genome, purpose: o.purpose, tier: o.tier, runId: o.runId, episodeKey, trace, plan, recordPath: null, failedReason: `harness_error: ${String(error).slice(0, 200)}` });
  }
  if (trace.finalImages !== undefined && trace.finalImages.length > 0) finalImages.set(episodeKey, trace.finalImages);
  bus?.emit({ type: 'agent_status', role: 'loader', status: 'done', label: `${task.title}: ${(summary.share * 100).toFixed(0)}%`, episodeKey });
  if (washSaid) shard.washing = Math.max(0, shard.washing - 1);
  o.game.release(shard);
  bus?.emit({ type: 'episode_finished', summary });
  try {
    o.memory?.recordEpisode(summary);
  } catch (error) {
    bus?.log(`memory.recordEpisode: ${String(error)}`, 'warn');
  }
  return summary;
}
