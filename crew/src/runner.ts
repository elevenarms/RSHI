/**
 * Running tasks: one game server per wash tier, one episode per task, summarised item by item and
 * recorded in memory (exam episodes are held out by memory itself).
 */

import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import type { HarnessGame } from '@spotless/bench';
import { runEpisode, startGame } from '@spotless/bench';
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

const games = new Map<string, Promise<HarnessGame>>();

/** The game server of a tier (started once per process), offering every task. */
export function gameFor(tier: Tier, tasks: readonly TaskSpec[]): Promise<HarnessGame> {
  const key = `${tier}:${tasks.map((t) => t.id).sort().join(',')}`;
  let g = games.get(key);
  if (g === undefined) {
    g = startGame({
      dataDir: join(process.env['CREW_GAME_DIR'] ?? CREW_ROOT, `game-${tier}`),
      washTier: tier,
      render: true,
      levels: tasks.map((t) => t.level as Level),
      server: { staticDir: DEFAULT_STATIC_DIR },
    });
    games.set(key, g);
  }
  return g;
}

export async function closeGames(): Promise<void> {
  for (const g of games.values()) await (await g).close().catch(() => undefined);
  games.clear();
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
  readonly game: HarnessGame;
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
  const log = (line: string): void => {
    const m = /^episode ([0-9a-f-]{36}):/.exec(line);
    if (m !== null) {
      const sessionId = m[1] as string;
      bus?.emit({ type: 'episode_started', episodeKey, sessionId, watchUrl: `${o.game.url}/#${sessionId}&watch`, taskId: task.id, taskTitle: task.title, genomeId: genome.id, purpose: o.purpose, pointsAvailable: task.pointsAvailable, itemCount: task.itemCount, items: level.items.map((i) => ({ itemId: i.id, kind: i.itemType, soils: i.soils.map((s) => s.type), points: i.points, ...labelOf(i.itemType) })) });
      bus?.emit({ type: 'agent_status', role: 'loader', status: 'acting', label: `loading ${task.title}`, episodeKey });
    } else if (line.startsWith('wash ') && !washSaid) {
      washSaid = true;
      bus?.emit({ type: 'wash', episodeKey, status: 'started', detail: line });
      bus?.emit({ type: 'agent_status', role: 'loader', status: 'idle', label: 'washing', episodeKey });
    }
  };
  let summary: EpisodeSummary;
  try {
    const result = await runEpisode({ game: o.game, levelId: task.id, policy, seed: 1, outDir, verify: 'none', saveImages: false, log });
    summary = summarise({ record: result.record, task, genome, purpose: o.purpose, tier: o.tier, runId: o.runId, episodeKey, trace, plan, recordPath: result.file });
    const washFailed = result.record.wash?.status === 'failed' || result.record.score === null;
    bus?.emit({ type: 'wash', episodeKey, status: washFailed ? 'failed' : 'done', detail: washFailed ? summary.stopped : `${summary.points}/${summary.pointsAvailable} points` });
  } catch (error) {
    bus?.log(`episode ${episodeKey} failed: ${String(error)}`, 'error');
    summary = summarise({ record: null, task, genome, purpose: o.purpose, tier: o.tier, runId: o.runId, episodeKey, trace, plan, recordPath: null, failedReason: `harness_error: ${String(error).slice(0, 200)}` });
  }
  if (trace.finalImages !== undefined && trace.finalImages.length > 0) finalImages.set(episodeKey, trace.finalImages);
  bus?.emit({ type: 'agent_status', role: 'loader', status: 'done', label: `${task.title}: ${(summary.share * 100).toFixed(0)}%`, episodeKey });
  bus?.emit({ type: 'episode_finished', summary });
  try {
    o.memory?.recordEpisode(summary);
  } catch (error) {
    bus?.log(`memory.recordEpisode: ${String(error)}`, 'warn');
  }
  return summary;
}
