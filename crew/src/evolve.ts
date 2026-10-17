/**
 * The loop. Gen 0 (baseline) practises on K train tasks -> the Critic reviews each -> the Coach
 * proposes -> every candidate and the incumbent play the SAME fresh validation tasks (train split,
 * new seeds) -> the Gatekeeper keeps the best candidate that beats the incumbent by the margin.
 * The incumbent's validation episodes count as its practice for the next generation.
 */

import type { EpisodeSummary, Genome, Role, TaskSpec } from './contracts.ts';
import type { CrewMemory } from './memory/index.ts';
import type { EventBus } from './bus.ts';
import { modelFor } from './crusoe.ts';
import { decide, DEFAULT_MARGIN, isInvalid } from './gatekeeper.ts';
import { applyEdits, diffGenomes } from './genome.ts';
import { CONCURRENCY, type GamePool, finalImages, pool, runTask, type Tier } from './runner.ts';
import { critique } from './team/critic.ts';
import { propose } from './team/coach.ts';

export interface EvolveOptions {
  readonly generations: number;
  readonly practice: number;
  readonly validate: number;
  readonly proposals: number;
  readonly tier: Tier;
  readonly concurrency?: number;
  readonly margin?: number;
  readonly runId: string;
  readonly runDir: string;
  readonly bus: EventBus;
  readonly memory: CrewMemory;
  readonly game: GamePool;
  /** Train tasks: practice uses seeds [0, practice), validation of generation g uses fresh seeds. */
  readonly tasksFor: (count: number, seedBase: number) => TaskSpec[];
  /** Resume: the incumbent to continue from (generations count on from its generation). */
  readonly resumeFrom?: Genome;
  /** Seed base of the practice a resumed incumbent still lacks. */
  readonly resumePracticeSeed?: number;
}

export const MODELS = (loader: string): { [r in Role]?: string } => ({ loader, planner: modelFor('planner'), critic: modelFor('critic'), coach: modelFor('coach'), librarian: modelFor('librarian'), gatekeeper: 'statistics (local)' });

export function emitMemory(bus: EventBus, memory: CrewMemory): void {
  const snap = memory.snapshot(12);
  bus.emit({ type: 'memory', stats: snap.stats, topLessons: snap.topLessons, placementStats: snap.placementStats });
}

async function review(o: EvolveOptions, genome: Genome, summaries: readonly EpisodeSummary[]): Promise<void> {
  const { bus, memory } = o;
  await pool(summaries.filter((s) => !s.failed), o.concurrency ?? CONCURRENCY, async (s) => {
    const images = finalImages.get(s.episodeKey);
    finalImages.delete(s.episodeKey);
    const c = await critique({ summary: s, genome, bus, ...(images === undefined ? {} : { images }) });
    if (c === null) return;
    bus.emit({ type: 'agent_status', role: 'librarian', status: 'acting', label: `filing ${c.lessons.length} lessons` });
    const touched = memory.addCritique(c);
    for (const l of touched) bus.emit({ type: 'message', from: 'librarian', to: 'coach', kind: 'lesson', title: `Lesson ${l.id} (conf ${l.confidence.toFixed(2)})`, body: l.text });
    bus.emit({ type: 'agent_status', role: 'librarian', status: 'idle', label: `${memory.stats().lessons} lessons` });
  });
  emitMemory(bus, memory);
}

const mean = (xs: readonly EpisodeSummary[]): number => (xs.length === 0 ? 0 : xs.reduce((a, s) => a + (s.failed ? 0 : s.share), 0) / xs.length);

/** Runs the loop; returns the champion. */
export async function evolve(o: EvolveOptions, baseline: Genome): Promise<Genome> {
  const { bus, memory, game } = o;
  const n = o.concurrency ?? CONCURRENCY;
  let incumbent = o.resumeFrom ?? baseline;
  let history: EpisodeSummary[];
  const start = incumbent.generation;
  if (o.resumeFrom === undefined) {
    memory.saveGenome(baseline, 'baseline');
    bus.emit({ type: 'genome', genome: baseline, status: 'baseline' });
    bus.emit({ type: 'phase', phase: 'baseline', generation: 0, detail: `${baseline.id} practises on ${o.practice} train tasks` });
    const practiceTasks = o.tasksFor(o.practice, 0);
    history = await pool(practiceTasks, n, (task) => runTask({ game, task, genome: incumbent, memory, bus, purpose: 'train', tier: o.tier, runId: o.runId, runDir: o.runDir }));
    bus.log(`baseline practice mean share ${mean(history).toFixed(3)}`);
  } else {
    // The incumbent's learnable episodes already in memory; only the missing practice is played.
    history = memory.episodes({ genomeId: incumbent.id }).filter((s) => !s.failed && (s.purpose === 'train' || s.purpose === 'eval')) as EpisodeSummary[];
    const missing = Math.max(0, o.practice - history.length);
    bus.emit({ type: 'phase', phase: 'practice', generation: start, detail: `resuming ${incumbent.id}: ${history.length} episodes in memory${missing > 0 ? `, ${missing} more practice` : ''}` });
    if (missing > 0) {
      const extra = await pool(o.tasksFor(missing, o.resumePracticeSeed ?? 500), n, (task) => runTask({ game, task, genome: incumbent, memory, bus, purpose: 'train', tier: o.tier, runId: o.runId, runDir: o.runDir }));
      history = [...history, ...extra];
    }
    // Reviewed already: only the new practice goes to the Critic.
    if (missing === 0) history = history.slice(-o.practice);
  }

  for (let gen = start + 1; gen <= start + o.generations; gen++) {
    bus.emit({ type: 'phase', phase: 'review', generation: gen, detail: `critic reviews ${history.length} episodes` });
    await review(o, incumbent, history);

    bus.emit({ type: 'phase', phase: 'propose', generation: gen, detail: `coach proposes ${o.proposals} change(s) to ${incumbent.id}` });
    bus.emit({ type: 'message', from: 'librarian', to: 'coach', kind: 'note', title: 'Memory statistics', body: `${memory.stats().lessons} lessons, ${memory.placementStats().length} placement cells, ${memory.decisions().length} past decisions` });
    const proposals = await propose({ incumbent, recent: memory.episodes({ split: 'train' }).slice(-12), lessons: memory.lessons(), stats: memory.placementStats(), decisions: memory.decisions(), count: o.proposals, bus });
    const candidates: { genome: Genome; title: string }[] = [];
    for (const p of proposals) {
      const { genome, applied, rejected } = applyEdits(incumbent, p);
      if (rejected.length > 0) bus.log(`proposal "${p.title}": ${rejected.length} edit(s) skipped (${rejected.map((r) => r.reason).join('; ')})`, 'warn');
      if (applied.length === 0 || candidates.some((c) => c.genome.id === genome.id)) continue;
      memory.saveGenome(genome, 'candidate');
      bus.emit({ type: 'genome', genome, status: 'candidate' });
      bus.log(`candidate ${genome.id}: ${diffGenomes(incumbent, genome).join(' | ')}`);
      candidates.push({ genome, title: p.title });
    }
    if (candidates.length === 0) {
      bus.log(`generation ${gen}: no usable proposal`, 'warn');
      continue;
    }

    const everyone = [{ genome: incumbent, title: 'incumbent' }, ...candidates];
    /** Plays the tasks with every genome; an invalid episode (infrastructure) is played again up to twice. */
    const evaluate = async (tasks: TaskSpec[]): Promise<EpisodeSummary[]> => {
      bus.emit({ type: 'phase', phase: 'evaluate', generation: gen, detail: `${incumbent.id} vs ${candidates.map((c) => c.genome.id).join(', ')} on ${tasks.map((t) => t.id).join(', ')}` });
      const jobs = everyone.flatMap((c) => tasks.map((task) => ({ c, task })));
      const out = await pool(jobs, n, async (j) => {
        let s = await runTask({ game, task: j.task, genome: j.c.genome, memory, bus, purpose: 'eval', tier: o.tier, runId: o.runId, runDir: o.runDir });
        for (let again = 1; again <= 2 && isInvalid(s); again++) {
          bus.log(`${s.episodeKey} is invalid (${s.stopped.slice(0, 80)}); playing it again (${again}/2)`, 'warn');
          s = await runTask({ game, task: j.task, genome: j.c.genome, memory, bus, purpose: 'eval', tier: o.tier, runId: o.runId, runDir: o.runDir });
        }
        return s;
      });
      return out;
    };
    let results = await evaluate(o.tasksFor(o.validate, 1000 * gen));
    const decideAll = (rs: EpisodeSummary[]) =>
      candidates.map((c) => ({ c, d: decide({ candidateId: c.genome.id, incumbentId: incumbent.id, proposalTitle: c.title, incumbent: rs.filter((s) => s.genomeId === incumbent.id), candidate: rs.filter((s) => s.genomeId === c.genome.id), margin: o.margin ?? DEFAULT_MARGIN }) }));
    let verdicts = decideAll(results);
    if (verdicts.some((v) => v.d.void === true)) {
      bus.log(`generation ${gen}: a comparison was void; evaluating again on reserve tasks`, 'warn');
      results = [...results, ...(await evaluate(o.tasksFor(o.validate, 1000 * gen + 500)))];
      verdicts = decideAll(results);
    }
    const of = (id: string): EpisodeSummary[] => results.filter((s) => s.genomeId === id && !isInvalid(s));
    const incumbentRuns = of(incumbent.id);

    let best: { genome: Genome; delta: number } | null = null;
    for (const { c, d } of verdicts) {
      memory.recordDecision(d);
      const status = d.accepted ? 'accepted' : d.void === true ? 'candidate' : 'rejected';
      memory.saveGenome(c.genome, status);
      bus.emit({ type: 'decision', decision: d });
      bus.emit({ type: 'genome', genome: c.genome, status });
      bus.emit({ type: 'message', from: 'gatekeeper', to: 'all', kind: 'verdict', title: `${c.title}: ${d.accepted ? 'ACCEPTED' : d.void === true ? 'VOID' : 'rejected'}`, body: d.reason });
      if (d.accepted && (best === null || d.delta > best.delta)) best = { genome: c.genome, delta: d.delta };
    }
    if (best !== null) {
      incumbent = best.genome;
      history = of(best.genome.id);
    } else history = incumbentRuns;
    bus.emit({ type: 'phase', phase: 'evaluate', generation: gen, detail: `incumbent after generation ${gen}: ${incumbent.id}` });
  }
  memory.saveGenome(incumbent, 'champion');
  bus.emit({ type: 'genome', genome: incumbent, status: 'champion' });
  emitMemory(bus, memory);
  return incumbent;
}
