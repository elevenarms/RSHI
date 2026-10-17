/**
 * The memory of the crew: what the team remembers across runs, as plain files in one directory
 * (`<repo>/.crew/memory`). Three kinds of memory:
 *
 *  - episodic: every episode, item by item (`episodes.jsonl`); exam episodes are kept apart
 *    (`exam.jsonl`) and never learned from: no lesson, no statistic, no brief sees them.
 *  - semantic: lessons. Lessons of the Critic and the Coach (`lessons.json`), merged by meaning
 *    without a model (normalised tokens, Jaccard similarity, tags), and observed lessons, derived
 *    from the placement statistics every time an episode is recorded (not stored: recomputed).
 *  - procedural: every genome with its status (`genomes.jsonl`), the Gatekeeper's decisions
 *    (`decisions.jsonl`), and from them the champion.
 *
 * Everything is synchronous. JSONL files are appended to (a torn last line after a crash is
 * skipped on reading); `lessons.json` is rewritten through a temporary file and a rename. The
 * files are read once when the memory is opened and kept in memory after that: one writer per
 * directory (another process may `reload()` to see what the writer added).
 *
 * Confidence of a lesson with `s` supporting and `c` contradicting episodes, `n = s + c`:
 *
 *     p = (s + 1) / (n + 2)                  posterior mean of a Beta(1, 1) prior
 *     confidence = 0.5 + (p - 0.5) * n / (n + K),   K = 3
 *
 * i.e. the posterior mean shrunk towards "don't know" (0.5) while the evidence is thin: one
 * supporting episode gives 0.54 (not 0.67), 5 of 5 give 0.72, 20 of 20 give 0.90, 4 of 5 0.60.
 */

import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import type {
  CrewMemoryApi,
  Critique,
  Decision,
  EpisodeSummary,
  Genome,
  Lesson,
  PlacementStat,
  Split,
} from '../contracts.ts';
import { normaliseTags, sameLessonScore, tokens } from './text.ts';

export { jaccard, normaliseTags, sameLessonScore, stem, tokens } from './text.ts';

/** Status of a genome in the procedural memory. */
export type GenomeStatus = 'candidate' | 'accepted' | 'rejected' | 'champion' | 'baseline';

/** Counts for the studio (the contract's, plus the held-out exam episodes). */
export interface MemoryStats {
  readonly episodes: number;
  readonly lessons: number;
  readonly genomes: number;
  readonly decisions: number;
  /** Exam episodes kept for the record (never learned from). */
  readonly examEpisodes: number;
}

/** What the studio's `memory` event carries. */
export interface MemorySnapshot {
  readonly stats: MemoryStats;
  readonly topLessons: readonly Lesson[];
  readonly placementStats: readonly PlacementStat[];
}

/** Options of a memory (for tests: a fixed clock). */
export interface CrewMemoryOptions {
  readonly now?: () => Date;
}

/** File names inside the memory directory. */
export const MEMORY_FILES = {
  episodes: 'episodes.jsonl',
  exam: 'exam.jsonl',
  lessons: 'lessons.json',
  genomes: 'genomes.jsonl',
  decisions: 'decisions.jsonl',
} as const;

/** Rack of an item that was offered but not loaded, in the statistics. */
export const LEFT_OUT = 'left_out';
/** Rack or stance of a loaded item whose rack or stance is not known. */
export const UNKNOWN = 'unknown';
/** Most episode keys a lesson keeps. */
export const MAX_EPISODE_KEYS = 50;
/** Smallest cell that becomes an observed lesson. */
export const MIN_OBSERVED = 2;
/** Most characters of a brief. */
export const BRIEF_MAX_CHARS = 2500;
/** Shrinkage constant K of the confidence (see the module comment). */
export const CONFIDENCE_K = 3;

/** Confidence of a lesson from its supporting and contradicting episodes (see the module comment). */
export function confidenceOf(support: number, contradict: number): number {
  const n = support + contradict;
  if (n <= 0) return 0.5;
  const p = (support + 1) / (n + 2);
  return 0.5 + ((p - 0.5) * n) / (n + CONFIDENCE_K);
}

/** True for an episode that is held out: an exam, or anything played on the test split. */
export function isHeldOut(summary: Pick<EpisodeSummary, 'purpose' | 'split'>): boolean {
  return summary.purpose.startsWith('exam-') || summary.split === 'test';
}

interface GenomeRecord {
  readonly at: string;
  readonly status: GenomeStatus;
  readonly genome: Genome;
}

interface LessonsFile {
  readonly nextId: number;
  readonly lessons: readonly Lesson[];
}

/** Ranking weight of a lesson, without regard to a level: confidence × log(1 + evidence). */
function weight(l: Lesson): number {
  return l.confidence * Math.log(1 + l.support + l.contradict);
}

function readJsonl<T>(path: string): T[] {
  if (!existsSync(path)) return [];
  const out: T[] = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.trim().length === 0) continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      // A torn line (a crash while appending): skipped.
    }
  }
  return out;
}

function appendJsonl(path: string, value: unknown): void {
  appendFileSync(path, `${JSON.stringify(value)}\n`);
}

function writeJsonAtomic(path: string, value: unknown): void {
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`);
  renameSync(tmp, path);
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Numeric order of `L-<n>` ids, then text order. */
function cmpId(a: string, b: string): number {
  const na = /^L-(\d+)$/.exec(a);
  const nb = /^L-(\d+)$/.exec(b);
  if (na && nb) return Number(na[1]) - Number(nb[1]);
  return cmp(a, b);
}

/** A stance in words: `upright` → `standing upright`, `tilted_30` → `tilted 30°`. */
function stanceWords(stance: string): string {
  switch (stance) {
    case 'upright':
      return 'standing upright';
    case 'flat':
      return 'lying flat';
    case 'on_side':
      return 'on its side';
    case UNKNOWN:
      return 'stance unknown';
    default: {
      const tilt = /^tilted_(-?\d+(?:\.\d+)?)$/.exec(stance);
      return tilt ? `tilted ${tilt[1]}°` : stance.replace(/_/g, ' ');
    }
  }
}

function pct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

/** The crew's memory over one directory. */
export class CrewMemory implements CrewMemoryApi {
  readonly dir: string;
  private readonly now: () => Date;
  private episodeList: EpisodeSummary[] = [];
  private examList: EpisodeSummary[] = [];
  private stored: Lesson[] = [];
  private nextLessonId = 1;
  private observed: Lesson[] = [];
  private stats_: PlacementStat[] = [];
  private genomeRecords: GenomeRecord[] = [];
  private decisionList: Decision[] = [];

  /** Opens (and creates, if missing) the memory in `dir`. */
  constructor(dir: string, options: CrewMemoryOptions = {}) {
    this.dir = dir;
    this.now = options.now ?? (() => new Date());
    mkdirSync(dir, { recursive: true });
    this.reload();
  }

  /** Same as `new CrewMemory(dir)`. */
  static open(dir: string, options: CrewMemoryOptions = {}): CrewMemory {
    return new CrewMemory(dir, options);
  }

  /** Reads every file again (to see what another process wrote). */
  reload(): void {
    mkdirSync(this.dir, { recursive: true });
    this.episodeList = dedupeByKey(readJsonl<EpisodeSummary>(this.path('episodes')));
    this.examList = dedupeByKey(readJsonl<EpisodeSummary>(this.path('exam')));
    const lessonsPath = this.path('lessons');
    if (existsSync(lessonsPath)) {
      const file = JSON.parse(readFileSync(lessonsPath, 'utf8')) as LessonsFile;
      this.stored = [...file.lessons];
      this.nextLessonId = file.nextId;
    } else {
      this.stored = [];
      this.nextLessonId = 1;
    }
    this.genomeRecords = readJsonl<GenomeRecord>(this.path('genomes'));
    this.decisionList = readJsonl<Decision>(this.path('decisions'));
    this.recompute();
  }

  // ---------------------------------------------------------------- episodic

  /**
   * Keeps an episode. A held-out one (purpose `exam-*`, or split `test`) goes to `exam.jsonl`
   * and changes nothing else; any other is learned from: the placement statistics and the
   * observed lessons are recomputed. An episode key recorded again replaces the earlier one.
   */
  recordEpisode(summary: EpisodeSummary): void {
    if (isHeldOut(summary)) {
      appendJsonl(this.path('exam'), summary);
      this.examList = dedupeByKey([...this.examList, summary]);
      return;
    }
    appendJsonl(this.path('episodes'), summary);
    this.episodeList = dedupeByKey([...this.episodeList, summary]);
    this.recompute();
  }

  /** The learnable episodes (train/eval/smoke) in the order recorded; never the exam ones. */
  episodes(filter: { readonly genomeId?: string; readonly split?: Split } = {}): readonly EpisodeSummary[] {
    return this.episodeList.filter(
      (e) => (filter.genomeId === undefined || e.genomeId === filter.genomeId) && (filter.split === undefined || e.split === filter.split),
    );
  }

  /** The held-out exam episodes in the order recorded (for the record and the exam report only). */
  examEpisodes(filter: { readonly genomeId?: string } = {}): readonly EpisodeSummary[] {
    return this.examList.filter((e) => filter.genomeId === undefined || e.genomeId === filter.genomeId);
  }

  // ---------------------------------------------------------------- semantic

  /**
   * Merges the lessons of a critique. Each is matched against the stored lessons (not the
   * observed ones): the best match by token Jaccard (≥ 0.5 with a tag in common, or ≥ 0.85
   * whatever the tags; never across a negation) takes the evidence and the union of the tags;
   * without a match it becomes a new lesson `L-<n>`. `support` polarity adds a supporting
   * episode, `contradict` a contradicting one, once per episode key per lesson (an episode
   * already among the lesson's keys is not counted again). Returns the lessons touched.
   */
  addCritique(critique: Critique, source: 'critic' | 'coach' = 'critic'): readonly Lesson[] {
    const at = this.now().toISOString();
    const touched = new Map<string, Lesson>();
    for (const item of critique.lessons) {
      const text = item.text.trim();
      if (text.length === 0) continue;
      const tags = normaliseTags(item.tags);
      const probe = { tokens: tokens(text), tags };
      let best = -1;
      let bestScore = 0;
      this.stored.forEach((l, i) => {
        const score = sameLessonScore(probe, { tokens: tokens(l.text), tags: l.tags });
        if (score > bestScore) {
          bestScore = score;
          best = i;
        }
      });
      const support = item.polarity === 'support' ? 1 : 0;
      const contradict = item.polarity === 'contradict' ? 1 : 0;
      if (best < 0) {
        const lesson: Lesson = {
          id: `L-${this.nextLessonId}`,
          text,
          tags,
          source,
          support,
          contradict,
          confidence: confidenceOf(support, contradict),
          episodeKeys: [critique.episodeKey],
          createdAt: at,
          updatedAt: at,
        };
        this.nextLessonId += 1;
        this.stored.push(lesson);
        touched.set(lesson.id, lesson);
        continue;
      }
      const old = this.stored[best] as Lesson;
      const counted = old.episodeKeys.includes(critique.episodeKey);
      const s = old.support + (counted ? 0 : support);
      const c = old.contradict + (counted ? 0 : contradict);
      const merged: Lesson = {
        ...old,
        tags: normaliseTags([...old.tags.filter((t) => t !== 'general' || tags.includes('general')), ...tags]),
        support: s,
        contradict: c,
        confidence: confidenceOf(s, c),
        episodeKeys: counted ? old.episodeKeys : [...old.episodeKeys, critique.episodeKey].slice(-MAX_EPISODE_KEYS),
        updatedAt: at,
      };
      this.stored[best] = merged;
      touched.set(merged.id, merged);
    }
    if (touched.size > 0) this.saveLessons();
    return [...touched.values()];
  }

  /** Every lesson: the stored ones (by id), then the observed ones (by id). */
  lessons(): readonly Lesson[] {
    return [...this.storedLessons(), ...this.observed];
  }

  /** The lessons of the Critic and the Coach, by id. */
  storedLessons(): readonly Lesson[] {
    return [...this.stored].sort((a, b) => cmpId(a.id, b.id));
  }

  /** The lessons derived from the placement statistics, by id. */
  observedLessons(): readonly Lesson[] {
    return this.observed;
  }

  /**
   * Clean rate per (kind, rack, stance) over the learnable episodes, sorted by kind, rack,
   * stance. A loaded item without a known rack or stance counts under `unknown`; an item
   * offered but not loaded counts under rack `left_out` (stance `unknown`).
   */
  placementStats(): readonly PlacementStat[] {
    return this.stats_;
  }

  /**
   * The Librarian's brief for a level, as text for a prompt (at most `BRIEF_MAX_CHARS`):
   *  1. per kind of the level, the best and the worst placement on record (ranked by the
   *     smoothed rate (clean + 1) / (n + 2), so one lucky item does not win) and how often it
   *     was left out;
   *  2. the stored lessons whose tags meet the level's kinds and soils, and the `general` ones,
   *     with confidence ≥ 0.5, ranked by confidence × relevance × log(1 + evidence), where
   *     relevance is 1 + 0.5 per further matching tag, or 0.5 for a general lesson. Observed
   *     lessons are left out here: part 1 already says what they say.
   *  3. one line when the memory knows nothing yet.
   * The same memory and card always give the same text.
   */
  briefFor(card: { readonly kinds: readonly string[]; readonly soils: readonly string[] }, maxLessons: number): string {
    const kinds = [...new Set(card.kinds.map((k) => k.toLowerCase()))].sort();
    const levelTags = new Set([...kinds, ...card.soils.map((s) => s.toLowerCase())]);
    if (this.episodeList.length === 0 && this.stored.length === 0) {
      return 'Memory is empty: no episodes played and no lessons learned yet.';
    }
    const lines: string[] = [];
    let used = 0;
    const push = (line: string): boolean => {
      if (used + line.length + 1 > BRIEF_MAX_CHARS) return false;
      lines.push(line);
      used += line.length + 1;
      return true;
    };

    push(`Placement record (${this.episodeList.length} episodes, clean/n):`);
    for (const kind of kinds) {
      const cells = this.stats_.filter((s) => s.kind === kind);
      const placed = cells
        .filter((s) => s.rack !== LEFT_OUT)
        .sort((a, b) => smoothed(b) - smoothed(a) || b.n - a.n || cmp(a.rack, b.rack) || cmp(a.stance, b.stance));
      const leftOut = cells.find((s) => s.rack === LEFT_OUT);
      const parts: string[] = [];
      const best = placed[0];
      const worst = placed[placed.length - 1];
      if (best === undefined) parts.push('never loaded yet');
      else if (placed.length === 1 || worst === undefined) parts.push(`only ${cell(best)}`);
      else parts.push(`best ${cell(best)}`, `worst ${cell(worst)}`);
      if (leftOut) parts.push(`left out ${leftOut.n}×`);
      if (best === undefined && !leftOut) parts.splice(0, parts.length, 'no record yet');
      if (!push(`- ${kind}: ${parts.join('; ')}`)) break;
    }

    const ranked = this.stored
      .filter((l) => l.confidence >= 0.5)
      .map((l) => ({ l, score: l.confidence * relevance(l, levelTags) * Math.log(1 + l.support + l.contradict) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || cmpId(a.l.id, b.l.id))
      .slice(0, Math.max(0, maxLessons));
    if (ranked.length > 0 && push('Lessons (id, confidence, support/contradict):')) {
      for (const { l } of ranked) {
        if (!push(`- [${l.id} ${l.confidence.toFixed(2)} ${l.support}/${l.contradict}] ${l.text}`)) break;
      }
    } else if (ranked.length === 0) {
      push('No lessons on record for this level yet.');
    }
    return lines.join('\n');
  }

  // ---------------------------------------------------------------- procedural

  /** Appends a genome with its status (a genome saved again with a new status changes status). */
  saveGenome(genome: Genome, status: GenomeStatus): void {
    const record: GenomeRecord = { at: this.now().toISOString(), status, genome };
    appendJsonl(this.path('genomes'), record);
    this.genomeRecords.push(record);
  }

  /** Every genome once, in the order first saved, with its latest status (and latest copy). */
  genomes(): readonly { readonly genome: Genome; readonly status: GenomeStatus }[] {
    const latest = new Map<string, { genome: Genome; status: GenomeStatus }>();
    for (const r of this.genomeRecords) {
      const prev = latest.get(r.genome.id);
      if (prev) {
        prev.genome = r.genome;
        prev.status = r.status;
      } else latest.set(r.genome.id, { genome: r.genome, status: r.status });
    }
    return [...latest.values()];
  }

  /** Appends a decision of the Gatekeeper. */
  recordDecision(decision: Decision): void {
    appendJsonl(this.path('decisions'), decision);
    this.decisionList.push(decision);
  }

  /** The decisions in the order made. */
  decisions(): readonly Decision[] {
    return this.decisionList;
  }

  /**
   * The genome to play with: the one most recently saved as `champion` (and still champion),
   * else the most recently `accepted`, else the `baseline`; null when no genome is saved.
   */
  champion(): Genome | null {
    const current = new Map(this.genomes().map((g) => [g.genome.id, g.status] as const));
    for (const status of ['champion', 'accepted', 'baseline'] as const) {
      for (let i = this.genomeRecords.length - 1; i >= 0; i -= 1) {
        const r = this.genomeRecords[i] as GenomeRecord;
        if (r.status === status && current.get(r.genome.id) === status) return r.genome;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- studio, experiments

  /** Counts for the studio. `lessons` counts stored and observed lessons. */
  stats(): MemoryStats {
    return {
      episodes: this.episodeList.length,
      lessons: this.stored.length + this.observed.length,
      genomes: this.genomes().length,
      decisions: this.decisionList.length,
      examEpisodes: this.examList.length,
    };
  }

  /** What the studio's `memory` event carries: counts, the strongest lessons, the statistics. */
  snapshot(maxLessons = 12): MemorySnapshot {
    const topLessons = [...this.lessons()]
      .sort((a, b) => weight(b) - weight(a) || cmpId(a.id, b.id))
      .slice(0, Math.max(0, maxLessons));
    return { stats: this.stats(), topLessons, placementStats: this.stats_ };
  }

  /**
   * Moves the whole memory aside to `<dir>.bak-<time>` and starts empty. Returns the path the
   * old memory was moved to.
   */
  reset(): string {
    const backup = `${this.dir}.bak-${this.now().toISOString().replace(/[:.]/g, '-')}`;
    if (existsSync(this.dir)) renameSync(this.dir, backup);
    this.reload();
    return backup;
  }

  /** Copies the memory to `toDir` (which must not exist or be empty) and opens the copy. */
  fork(toDir: string): CrewMemory {
    if (existsSync(toDir) && readdirSync(toDir).length > 0) {
      throw new Error(`CrewMemory.fork: ${toDir} exists and is not empty`);
    }
    mkdirSync(dirname(toDir), { recursive: true });
    cpSync(this.dir, toDir, { recursive: true, filter: (src) => !/\.tmp-\d+$/.test(src) });
    return new CrewMemory(toDir, { now: this.now });
  }

  // ---------------------------------------------------------------- internals

  private path(file: keyof typeof MEMORY_FILES): string {
    return join(this.dir, MEMORY_FILES[file]);
  }

  private saveLessons(): void {
    const file: LessonsFile = { nextId: this.nextLessonId, lessons: this.storedLessons() };
    writeJsonAtomic(this.path('lessons'), file);
  }

  /** Placement statistics and observed lessons from the learnable episodes. */
  private recompute(): void {
    interface Cell {
      kind: string;
      rack: string;
      stance: string;
      n: number;
      clean: number;
      keys: string[];
      first: string;
      last: string;
    }
    const cells = new Map<string, Cell>();
    for (const e of this.episodeList) {
      for (const item of e.items) {
        const kind = item.kind.toLowerCase();
        const rack = item.loaded ? (item.rack ?? UNKNOWN) : LEFT_OUT;
        const stance = item.loaded ? (item.stance ?? UNKNOWN) : UNKNOWN;
        const key = `${kind}\u0000${rack}\u0000${stance}`;
        let c = cells.get(key);
        if (!c) {
          c = { kind, rack, stance, n: 0, clean: 0, keys: [], first: e.finishedAt, last: e.finishedAt };
          cells.set(key, c);
        }
        c.n += 1;
        if (item.loaded && item.clean) c.clean += 1;
        if (!c.keys.includes(e.episodeKey)) c.keys.push(e.episodeKey);
        if (e.finishedAt < c.first) c.first = e.finishedAt;
        if (e.finishedAt > c.last) c.last = e.finishedAt;
      }
    }
    const sorted = [...cells.values()].sort((a, b) => cmp(a.kind, b.kind) || cmp(a.rack, b.rack) || cmp(a.stance, b.stance));
    this.stats_ = sorted.map((c) => ({ kind: c.kind, rack: c.rack, stance: c.stance, n: c.n, clean: c.clean, rate: c.n > 0 ? c.clean / c.n : 0 }));
    this.observed = sorted
      .filter((c) => c.n >= MIN_OBSERVED)
      .map((c) => {
        const text =
          c.rack === LEFT_OUT
            ? `${c.kind} left out (not loaded): ${c.n} times`
            : `${c.kind} in ${c.rack === UNKNOWN ? 'an unknown rack' : c.rack} ${stanceWords(c.stance)}: clean ${c.clean} of ${c.n} (${pct(c.clean / c.n)})`;
        return {
          id: `O-${c.kind}-${c.rack}-${c.stance}`,
          text,
          tags: [c.kind, c.rack, c.stance],
          source: 'observed' as const,
          support: c.clean,
          contradict: c.n - c.clean,
          confidence: confidenceOf(c.clean, c.n - c.clean),
          episodeKeys: c.keys.slice(-MAX_EPISODE_KEYS),
          createdAt: c.first,
          updatedAt: c.last,
        };
      });
  }
}

/** Last record of each episode key wins; the order is that of first appearance. */
function dedupeByKey(list: readonly EpisodeSummary[]): EpisodeSummary[] {
  const byKey = new Map<string, EpisodeSummary>();
  for (const e of list) byKey.set(e.episodeKey, e);
  return [...byKey.values()];
}

function smoothed(s: PlacementStat): number {
  return (s.clean + 1) / (s.n + 2);
}

function cell(s: PlacementStat): string {
  const where = s.stance === UNKNOWN ? s.rack : `${s.rack}/${s.stance}`;
  return `${where} ${s.clean}/${s.n} (${pct(s.rate)})`;
}

/** Relevance of a lesson to a level: 1 + 0.5 per further tag met, 0.5 for a general lesson, else 0. */
function relevance(l: Lesson, levelTags: ReadonlySet<string>): number {
  const met = l.tags.filter((t) => levelTags.has(t)).length;
  if (met > 0) return 1 + 0.5 * (met - 1);
  return l.tags.includes('general') ? 0.5 : 0;
}
