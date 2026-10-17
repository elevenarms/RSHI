/**
 * The state of the studio, derived from the crew's events by a pure fold: `reduce(state, event)`
 * never mutates `state` and never reads the clock, so a replay can rebuild any moment by folding
 * the events up to it, and the live view is the same fold applied one event at a time.
 */

import type {
  CrewEvent,
  Decision,
  EpisodePurpose,
  EpisodeSummary,
  Genome,
  Lesson,
  PlacementStat,
  Role,
} from '@spotless/crew/contracts';

export const ROLE_LIST: readonly Role[] = ['planner', 'loader', 'critic', 'coach', 'gatekeeper', 'librarian'];

type Ev<T extends CrewEvent['type']> = Extract<CrewEvent, { type: T }>;

export type PhaseName = Ev<'phase'>['phase'];
export type AgentStatus = Ev<'agent_status'>['status'];
export type GenomeStatus = Ev<'genome'>['status'];

export interface AgentView {
  readonly status: AgentStatus;
  readonly label: string;
  readonly episodeKey: string | null;
  readonly since: string | null;
}

export interface MessageView {
  /** Sequence number of the event (unique, increasing). */
  readonly id: number;
  readonly at: string;
  readonly from: Role;
  readonly to: Role | 'all';
  readonly kind: Ev<'message'>['kind'];
  readonly title: string;
  readonly body: string;
}

export type StreamItem =
  | {
      readonly id: number;
      readonly at: string;
      readonly type: 'turn';
      readonly role: Role;
      readonly text: string;
      readonly toolCalls: readonly string[];
      readonly tokensIn: number;
      readonly tokensOut: number;
      readonly ms: number;
    }
  | {
      readonly id: number;
      readonly at: string;
      readonly type: 'tool';
      readonly seq: number;
      readonly name: string;
      readonly args: unknown;
      readonly ok: boolean;
      readonly summary: string;
    }
  | { readonly id: number; readonly at: string; readonly type: 'wash'; readonly status: string; readonly detail: string };

export interface EpisodeView {
  readonly key: string;
  readonly sessionId: string;
  readonly watchUrl: string;
  readonly taskId: string;
  readonly taskTitle: string;
  readonly genomeId: string;
  readonly purpose: EpisodePurpose;
  readonly pointsAvailable: number;
  readonly itemCount: number;
  readonly startedAt: string;
  readonly finishedAt: string | null;
  readonly summary: EpisodeSummary | null;
  readonly wash: 'started' | 'done' | 'failed' | null;
  readonly stream: readonly StreamItem[];
  readonly toolCalls: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
}

export interface GenomeView {
  readonly genome: Genome;
  readonly status: GenomeStatus;
  readonly at: string;
  /** Order of first appearance. */
  readonly order: number;
}

export interface LogView {
  readonly id: number;
  readonly at: string;
  readonly level: 'info' | 'warn' | 'error';
  readonly text: string;
}

export interface StudioState {
  /** Events folded so far. */
  readonly seq: number;
  readonly runId: string | null;
  readonly firstAt: string | null;
  readonly lastAt: string | null;
  readonly run: Omit<Ev<'run_started'>, 'type'> | null;
  readonly phase: { readonly phase: PhaseName; readonly generation: number; readonly detail: string; readonly at: string } | null;
  /** Every (phase, generation) entered, in order. */
  readonly phaseHistory: readonly { readonly phase: PhaseName; readonly generation: number; readonly at: string }[];
  readonly agents: { readonly [R in Role]: AgentView };
  readonly messages: readonly MessageView[];
  readonly episodes: { readonly [key: string]: EpisodeView };
  /** Episode keys in the order they started. */
  readonly episodeOrder: readonly string[];
  readonly tokens: { readonly in: number; readonly out: number; readonly cached: number; readonly turns: number; readonly toolCalls: number };
  readonly genomes: { readonly [id: string]: GenomeView };
  readonly decisions: readonly Decision[];
  readonly memory: {
    readonly stats: { readonly episodes: number; readonly lessons: number; readonly genomes: number; readonly decisions: number };
    readonly topLessons: readonly Lesson[];
    readonly placementStats: readonly PlacementStat[];
    readonly at: string;
  } | null;
  readonly exam: (Omit<Ev<'exam'>, 'type' | 'runId'> & { readonly seq: number }) | null;
  readonly logs: readonly LogView[];
}

export const MAX_MESSAGES = 250;
export const MAX_STREAM = 400;
export const MAX_LOGS = 200;

function idleAgents(): StudioState['agents'] {
  const a = {} as { [R in Role]: AgentView };
  for (const r of ROLE_LIST) a[r] = { status: 'idle', label: '', episodeKey: null, since: null };
  return a;
}

export function initialState(): StudioState {
  return {
    seq: 0,
    runId: null,
    firstAt: null,
    lastAt: null,
    run: null,
    phase: null,
    phaseHistory: [],
    agents: idleAgents(),
    messages: [],
    episodes: {},
    episodeOrder: [],
    tokens: { in: 0, out: 0, cached: 0, turns: 0, toolCalls: 0 },
    genomes: {},
    decisions: [],
    memory: null,
    exam: null,
    logs: [],
  };
}

function capped<T>(list: readonly T[], item: T, max: number): readonly T[] {
  const next = list.length >= max ? list.slice(list.length - max + 1) : list.slice();
  next.push(item);
  return next;
}

/** A placeholder for an episode whose `episode_started` was missed (e.g. a log cut short). */
function ghostEpisode(key: string, at: string): EpisodeView {
  return {
    key,
    sessionId: '',
    watchUrl: 'about:blank',
    taskId: '?',
    taskTitle: key,
    genomeId: '?',
    purpose: 'train',
    pointsAvailable: 0,
    itemCount: 0,
    startedAt: at,
    finishedAt: null,
    summary: null,
    wash: null,
    stream: [],
    toolCalls: 0,
    tokensIn: 0,
    tokensOut: 0,
  };
}

/**
 * Updates a known episode. Events for an unknown key (a Coach or Gatekeeper turn keyed by
 * something other than an episode) leave the episodes alone; an `episode_finished` without a
 * start makes a placeholder so its score still counts.
 */
function withEpisode(s: StudioState, key: string, at: string, f: (e: EpisodeView) => EpisodeView, create = false): StudioState {
  const known = s.episodes[key];
  if (!known && !create) return s;
  const base = known ?? ghostEpisode(key, at);
  return {
    ...s,
    episodes: { ...s.episodes, [key]: f(base) },
    episodeOrder: known ? s.episodeOrder : [...s.episodeOrder, key],
  };
}

/** Folds one event into the state. Pure. An unknown event type only advances `seq`. */
export function reduce(prev: StudioState, ev: CrewEvent): StudioState {
  // A new run (another runId announced by run_started) starts from a clean slate.
  let s0 = prev;
  if (ev.type === 'run_started' && prev.runId !== null && prev.runId !== ev.runId) s0 = initialState();
  const id = s0.seq + 1;
  const s: StudioState = {
    ...s0,
    seq: id,
    runId: s0.runId ?? ev.runId,
    firstAt: s0.firstAt ?? ev.at,
    lastAt: ev.at,
  };

  switch (ev.type) {
    case 'run_started': {
      const { type: _t, ...run } = ev;
      return { ...s, runId: ev.runId, run };
    }
    case 'phase': {
      const phase = { phase: ev.phase, generation: ev.generation, detail: ev.detail, at: ev.at };
      const last = s.phaseHistory[s.phaseHistory.length - 1];
      const phaseHistory =
        last && last.phase === ev.phase && last.generation === ev.generation
          ? s.phaseHistory
          : [...s.phaseHistory, { phase: ev.phase, generation: ev.generation, at: ev.at }];
      return { ...s, phase, phaseHistory };
    }
    case 'agent_status': {
      const old = s.agents[ev.role];
      const agent: AgentView = {
        status: ev.status,
        label: ev.label,
        episodeKey: ev.episodeKey ?? null,
        since: old && old.status === ev.status ? old.since : ev.at,
      };
      return { ...s, agents: { ...s.agents, [ev.role]: agent } };
    }
    case 'message': {
      const m: MessageView = { id, at: ev.at, from: ev.from, to: ev.to, kind: ev.kind, title: ev.title, body: ev.body };
      return { ...s, messages: capped(s.messages, m, MAX_MESSAGES) };
    }
    case 'episode_started': {
      const old = s.episodes[ev.episodeKey];
      const e: EpisodeView = {
        ...(old ?? ghostEpisode(ev.episodeKey, ev.at)),
        sessionId: ev.sessionId,
        watchUrl: ev.watchUrl,
        taskId: ev.taskId,
        taskTitle: ev.taskTitle,
        genomeId: ev.genomeId,
        purpose: ev.purpose,
        pointsAvailable: ev.pointsAvailable,
        itemCount: ev.itemCount,
        startedAt: ev.at,
      };
      return {
        ...s,
        episodes: { ...s.episodes, [ev.episodeKey]: e },
        episodeOrder: old ? s.episodeOrder : [...s.episodeOrder, ev.episodeKey],
      };
    }
    case 'tool_call': {
      const item: StreamItem = { id, at: ev.at, type: 'tool', seq: ev.seq, name: ev.name, args: ev.args, ok: ev.ok, summary: ev.summary };
      const next = withEpisode(s, ev.episodeKey, ev.at, (e) => ({ ...e, stream: capped(e.stream, item, MAX_STREAM), toolCalls: e.toolCalls + 1 }));
      return { ...next, tokens: { ...s.tokens, toolCalls: s.tokens.toolCalls + 1 } };
    }
    case 'model_turn': {
      const item: StreamItem = {
        id,
        at: ev.at,
        type: 'turn',
        role: ev.role,
        text: ev.text,
        toolCalls: ev.toolCalls,
        tokensIn: ev.tokensIn,
        tokensOut: ev.tokensOut,
        ms: ev.ms,
      };
      const next = withEpisode(s, ev.episodeKey, ev.at, (e) => ({
        ...e,
        stream: capped(e.stream, item, MAX_STREAM),
        tokensIn: e.tokensIn + ev.tokensIn,
        tokensOut: e.tokensOut + ev.tokensOut,
      }));
      return {
        ...next,
        tokens: { ...s.tokens, in: s.tokens.in + ev.tokensIn, out: s.tokens.out + ev.tokensOut, turns: s.tokens.turns + 1 },
      };
    }
    case 'wash': {
      const item: StreamItem = { id, at: ev.at, type: 'wash', status: ev.status, detail: ev.detail };
      return withEpisode(s, ev.episodeKey, ev.at, (e) => ({ ...e, wash: ev.status, stream: capped(e.stream, item, MAX_STREAM) }));
    }
    case 'episode_finished': {
      const sum = ev.summary;
      const next = withEpisode(s, sum.episodeKey, ev.at, (e) => ({
        ...e,
        finishedAt: ev.at,
        summary: sum,
        genomeId: e.genomeId === '?' ? sum.genomeId : e.genomeId,
        taskId: e.taskId === '?' ? sum.taskId : e.taskId,
        purpose: sum.purpose,
        pointsAvailable: sum.pointsAvailable,
      }), true);
      return { ...next, tokens: { ...s.tokens, cached: s.tokens.cached + (sum.cachedTokens || 0) } };
    }
    case 'genome': {
      const old = s.genomes[ev.genome.id];
      const g: GenomeView = {
        genome: ev.genome,
        status: ev.status,
        at: old?.at ?? ev.at,
        order: old?.order ?? Object.keys(s.genomes).length,
      };
      const genomes: { [id: string]: GenomeView } = { ...s.genomes, [ev.genome.id]: g };
      // Only one champion at a time: a new champion demotes the old one to accepted.
      if (ev.status === 'champion') {
        for (const [gid, v] of Object.entries(genomes)) {
          if (gid !== ev.genome.id && v.status === 'champion') genomes[gid] = { ...v, status: v.genome.parentId === null ? 'baseline' : 'accepted' };
        }
      }
      return { ...s, genomes };
    }
    case 'decision':
      return { ...s, decisions: [...s.decisions, ev.decision] };
    case 'memory':
      return { ...s, memory: { stats: ev.stats, topLessons: ev.topLessons, placementStats: ev.placementStats, at: ev.at } };
    case 'exam': {
      const { type: _t, runId: _r, ...exam } = ev;
      return { ...s, exam: { ...exam, seq: id } };
    }
    case 'log':
      return { ...s, logs: capped(s.logs, { id, at: ev.at, level: ev.level, text: ev.text }, MAX_LOGS) };
    default:
      return s;
  }
}

export function foldEvents(events: readonly CrewEvent[], from: StudioState = initialState()): StudioState {
  let s = from;
  for (const e of events) s = reduce(s, e);
  return s;
}

// ---------------------------------------------------------------------------------------------
// Derived views (pure)
// ---------------------------------------------------------------------------------------------

export function mean(xs: readonly number[]): number | null {
  return xs.length === 0 ? null : xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** The genome currently holding the title: the champion, else the last accepted, else the baseline. */
export function championId(s: StudioState): string | null {
  const gs = Object.values(s.genomes).sort((a, b) => a.order - b.order);
  const champ = gs.filter((g) => g.status === 'champion').pop();
  if (champ) return champ.genome.id;
  const lastAccepted = [...s.decisions].reverse().find((d) => d.accepted);
  if (lastAccepted) return lastAccepted.candidateId;
  return gs.find((g) => g.status === 'baseline')?.genome.id ?? gs[0]?.genome.id ?? null;
}

/** Mean share of the finished episodes of a genome (optionally of some purposes). */
export function genomeMeanShare(s: StudioState, genomeId: string, purposes?: readonly EpisodePurpose[]): number | null {
  const shares: number[] = [];
  for (const k of s.episodeOrder) {
    const e = s.episodes[k];
    if (!e?.summary || e.genomeId !== genomeId) continue;
    if (purposes && !purposes.includes(e.summary.purpose)) continue;
    shares.push(e.summary.share);
  }
  return mean(shares);
}

export interface EvolutionPoint {
  /** 0 for the baseline, then one per decision. */
  readonly index: number;
  readonly generation: number;
  /** Score of the incumbent after this point (the champion line). */
  readonly champion: number;
  readonly candidate: number | null;
  readonly accepted: boolean | null;
  readonly title: string;
  readonly reason: string;
  readonly delta: number;
  readonly candidateId: string | null;
}

/** The champion line and the candidate dots of the evolution chart. */
export function evolution(s: StudioState): readonly EvolutionPoint[] {
  const pts: EvolutionPoint[] = [];
  const baselineId = Object.values(s.genomes).find((g) => g.status === 'baseline' || g.genome.parentId === null)?.genome.id ?? null;
  const first = s.decisions[0];
  const base = first ? first.incumbentScore : baselineId ? genomeMeanShare(s, baselineId, ['eval', 'train']) : null;
  if (base === null) return pts;
  pts.push({ index: 0, generation: 0, champion: base, candidate: null, accepted: null, title: 'baseline', reason: '', delta: 0, candidateId: baselineId });
  s.decisions.forEach((d, i) => {
    pts.push({
      index: i + 1,
      generation: s.genomes[d.candidateId]?.genome.generation ?? i + 1,
      // The incumbent is measured again on the same tasks at every decision.
      champion: d.accepted ? d.candidateScore : d.incumbentScore,
      candidate: d.candidateScore,
      accepted: d.accepted,
      title: d.proposalTitle,
      reason: d.reason,
      delta: d.delta,
      candidateId: d.candidateId,
    });
  });
  return pts;
}

export interface LineageNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly generation: number;
  readonly status: GenomeStatus;
  readonly rationale: string;
  readonly depth: number;
  /** Row of the node in the drawing (leaves get consecutive rows; parents sit at their first child). */
  readonly row: number;
  readonly score: number | null;
}

/** The genome family tree, laid out by depth (columns) and rows. */
export function lineage(s: StudioState): readonly LineageNode[] {
  const gs = Object.values(s.genomes).sort((a, b) => a.order - b.order);
  const byId = new Map(gs.map((g) => [g.genome.id, g]));
  const children = new Map<string | null, GenomeView[]>();
  for (const g of gs) {
    const p = g.genome.parentId !== null && byId.has(g.genome.parentId) ? g.genome.parentId : null;
    const list = children.get(p) ?? [];
    list.push(g);
    children.set(p, list);
  }
  const scoreOf = new Map<string, number>();
  for (const d of s.decisions) {
    scoreOf.set(d.candidateId, d.candidateScore);
    if (!scoreOf.has(d.incumbentId)) scoreOf.set(d.incumbentId, d.incumbentScore);
  }
  const out: LineageNode[] = [];
  let row = 0;
  const walk = (g: GenomeView, depth: number): void => {
    const myRow = row;
    out.push({
      id: g.genome.id,
      parentId: g.genome.parentId,
      generation: g.genome.generation,
      status: g.status,
      rationale: g.genome.rationale,
      depth,
      row: myRow,
      score: scoreOf.get(g.genome.id) ?? null,
    });
    const kids = children.get(g.genome.id) ?? [];
    // Accepted lines first so the main trunk stays straight.
    const ordered = [...kids].sort((a, b) => rank(a.status) - rank(b.status) || a.order - b.order);
    if (kids.length === 0) row++;
    ordered.forEach((k) => walk(k, depth + 1));
  };
  for (const root of children.get(null) ?? []) walk(root, 0);
  return out;
}

function rank(st: GenomeStatus): number {
  return st === 'champion' ? 0 : st === 'accepted' ? 1 : st === 'candidate' ? 2 : st === 'baseline' ? 0 : 3;
}

/** Episodes that are live at `nowMs` (not finished, or finished less than `lingerMs` ago), newest first. */
export function liveEpisodes(s: StudioState, nowMs: number, lingerMs: number): readonly EpisodeView[] {
  const out: EpisodeView[] = [];
  for (let i = s.episodeOrder.length - 1; i >= 0; i--) {
    const e = s.episodes[s.episodeOrder[i] ?? ''];
    if (!e) continue;
    if (e.finishedAt === null || nowMs - Date.parse(e.finishedAt) < lingerMs) out.push(e);
  }
  return out;
}

/** Per-task scores of a genome over finished episodes: taskId → mean share. */
export function perTaskShares(s: StudioState, genomeId: string): ReadonlyMap<string, number> {
  const acc = new Map<string, number[]>();
  for (const k of s.episodeOrder) {
    const e = s.episodes[k];
    if (!e?.summary || e.genomeId !== genomeId) continue;
    const l = acc.get(e.taskId) ?? [];
    l.push(e.summary.share);
    acc.set(e.taskId, l);
  }
  return new Map([...acc].map(([t, l]) => [t, mean(l) ?? 0]));
}
