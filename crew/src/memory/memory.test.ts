import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EpisodePurpose, EpisodeSummary, Genome, ItemOutcome } from '../contracts.ts';
import { CrewMemory, confidenceOf, sameLessonScore, tokens } from './index.ts';

let root: string;
let dir: string;
const clock = () => new Date('2026-10-17T12:00:00.000Z');

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'crew-memory-'));
  dir = join(root, 'memory');
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function item(kind: string, over: Partial<ItemOutcome> = {}): ItemOutcome {
  return {
    itemId: `${kind}-1`,
    kind,
    soils: [],
    points: 10,
    loaded: true,
    clean: true,
    rack: 'lower_rack',
    stance: 'upright',
    position_mm: null,
    quat_wxyz: null,
    holdsWater: false,
    retainedWaterMl: 0,
    movedDuringWash: false,
    residueRegions: [],
    residualFractionArea: 0,
    ...over,
  };
}

function episode(key: string, items: readonly ItemOutcome[], purpose: EpisodePurpose = 'train', over: Partial<EpisodeSummary> = {}): EpisodeSummary {
  return {
    episodeKey: key,
    runId: 'run-1',
    taskId: 'task-1',
    split: purpose.startsWith('exam-') ? 'test' : 'train',
    sourceLevelId: 'level-1',
    genomeId: 'g0',
    purpose,
    sessionId: null,
    tier: 'fast',
    points: 0,
    pointsAvailable: 10,
    share: 0,
    itemsOffered: items.length,
    itemsLoaded: items.filter((i) => i.loaded).length,
    itemsClean: items.filter((i) => i.clean).length,
    items,
    stopped: 'start_cycle',
    failed: false,
    turns: 1,
    actions: 1,
    queries: 0,
    rejectedCalls: 0,
    tokensIn: 0,
    tokensOut: 0,
    cachedTokens: 0,
    loadingS: 0,
    washS: 0,
    plan: null,
    loaderNotes: [],
    recordPath: null,
    finishedAt: `2026-10-17T10:00:0${key.length % 10}.000Z`,
    ...over,
  };
}

function genome(id: string): Genome {
  return {
    id,
    parentId: null,
    generation: 0,
    createdAt: '2026-10-17T00:00:00.000Z',
    rationale: 'baseline',
    team: { usePlanner: true, useMemoryBrief: true, preflightCheck: true, briefLessons: 8 },
    prompts: { planner: 'p', loaderPreamble: 'l', critic: 'c' },
    playbook: [],
    loader: { model: 'm', reasoningEffort: null, images: false, deniedTools: [], maxTurns: 40 },
  };
}

const BOWL_LESSON = { text: 'Bowls with porridge wash clean only mouth down in the upper rack.', tags: ['bowl', 'porridge'], polarity: 'support' as const };

describe('confidence', () => {
  it('is the posterior mean shrunk by the evidence', () => {
    expect(confidenceOf(0, 0)).toBe(0.5);
    expect(confidenceOf(1, 0)).toBeCloseTo(0.5417, 3);
    expect(confidenceOf(1, 0)).toBeLessThan(0.6);
    expect(confidenceOf(5, 0)).toBeGreaterThan(confidenceOf(1, 0));
    expect(confidenceOf(20, 0)).toBeGreaterThan(0.85);
    expect(confidenceOf(0, 3)).toBeLessThan(0.5);
    expect(confidenceOf(4, 4)).toBeCloseTo(0.5, 9);
  });
});

describe('text matching', () => {
  it('stems, drops stopwords and keeps negations apart', () => {
    expect(tokens('Loading the bowls!')).toEqual(['bowl', 'load']);
    const a = { tokens: tokens('Load bowls mouth down in the upper rack'), tags: ['bowl'] };
    const b = { tokens: tokens('Bowls should be loaded mouth down, upper rack.'), tags: ['bowl'] };
    const neg = { tokens: tokens("Don't load bowls mouth down in the upper rack"), tags: ['bowl'] };
    const otherTags = { tokens: tokens('Load bowls mouth down in the upper rack'), tags: ['cup'] };
    expect(sameLessonScore(a, b)).toBeGreaterThanOrEqual(0.5);
    expect(sameLessonScore(a, neg)).toBe(0);
    expect(sameLessonScore(a, otherTags)).toBe(1); // identical text merges whatever the tags
    const unrelated = { tokens: tokens('Glasses go in the upper rack upside down'), tags: ['cup'] };
    expect(sameLessonScore(a, unrelated)).toBe(0);
  });
});

describe('CrewMemory', () => {
  it('creates its directory and says when empty', () => {
    const m = new CrewMemory(dir);
    expect(existsSync(dir)).toBe(true);
    expect(m.stats()).toEqual({ episodes: 0, lessons: 0, genomes: 0, decisions: 0, examEpisodes: 0 });
    expect(m.briefFor({ kinds: ['bowl'], soils: [] }, 5)).toMatch(/^Memory is empty/);
    expect(m.champion()).toBeNull();
  });

  it('persists across instances', () => {
    const m = CrewMemory.open(dir, { now: clock });
    m.recordEpisode(episode('e1', [item('bowl'), item('bowl')]));
    m.recordEpisode(episode('x1', [item('bowl')], 'exam-baseline'));
    m.addCritique({ episodeKey: 'e1', worked: [], failed: [], lessons: [BOWL_LESSON] });
    m.saveGenome(genome('g0'), 'baseline');
    m.recordDecision({
      candidateId: 'g1', incumbentId: 'g0', proposalTitle: 't', accepted: false, incumbentScore: 0.5,
      candidateScore: 0.4, delta: -0.1, perTask: [], reason: 'worse', at: clock().toISOString(),
    });
    const n = new CrewMemory(dir);
    expect(n.episodes().map((e) => e.episodeKey)).toEqual(['e1']);
    expect(n.examEpisodes().map((e) => e.episodeKey)).toEqual(['x1']);
    expect(n.storedLessons().map((l) => l.id)).toEqual(['L-1']);
    expect(n.decisions()).toHaveLength(1);
    expect(n.champion()?.id).toBe('g0');
    expect(n.placementStats()).toEqual(m.placementStats());
    expect(n.lessons()).toEqual(m.lessons());
    expect(n.stats()).toEqual({ episodes: 1, lessons: 2, genomes: 1, decisions: 1, examEpisodes: 1 });
    // Ids keep increasing after reopening.
    n.addCritique({ episodeKey: 'e2', worked: [], failed: [], lessons: [{ text: 'Cutlery handles down in the basket.', tags: ['fork'], polarity: 'support' }] });
    expect(new CrewMemory(dir).storedLessons().map((l) => l.id)).toEqual(['L-1', 'L-2']);
  });

  it('skips a torn last line', () => {
    const m = new CrewMemory(dir);
    m.recordEpisode(episode('e1', [item('bowl')]));
    appendFileSync(join(dir, 'episodes.jsonl'), '{"episodeKey":"e2", "trunc');
    expect(new CrewMemory(dir).episodes()).toHaveLength(1);
  });

  it('dedupes and merges lessons, counting each episode once', () => {
    const m = new CrewMemory(dir, { now: clock });
    const first = m.addCritique({ episodeKey: 'e1', worked: [], failed: [], lessons: [BOWL_LESSON] });
    expect(first).toHaveLength(1);
    expect(first[0]).toMatchObject({ id: 'L-1', support: 1, contradict: 0, source: 'critic', tags: ['bowl', 'porridge'] });
    const second = m.addCritique({
      episodeKey: 'e2', worked: [], failed: [],
      lessons: [{ text: 'Porridge bowls: only mouth-down in the upper rack washes them clean', tags: ['Bowl', 'upper_rack'], polarity: 'support' }],
    });
    expect(second.map((l) => l.id)).toEqual(['L-1']);
    expect(second[0]).toMatchObject({ support: 2, contradict: 0, episodeKeys: ['e1', 'e2'], tags: ['bowl', 'porridge', 'upper_rack'] });
    const third = m.addCritique({ episodeKey: 'e3', worked: [], failed: [], lessons: [{ ...BOWL_LESSON, polarity: 'contradict' }] });
    expect(third[0]).toMatchObject({ id: 'L-1', support: 2, contradict: 1 });
    expect(third[0]?.confidence).toBeCloseTo(confidenceOf(2, 1), 9);
    // The same episode again is not counted twice.
    const again = m.addCritique({ episodeKey: 'e3', worked: [], failed: [], lessons: [BOWL_LESSON] });
    expect(again[0]).toMatchObject({ support: 2, contradict: 1 });
    // A different lesson and a negated one are new.
    const fresh = m.addCritique({
      episodeKey: 'e4', worked: [], failed: [],
      lessons: [
        { text: 'Never put porridge bowls mouth down in the upper rack.', tags: ['bowl'], polarity: 'support' },
        { text: 'Tall glasses tip over in the lower rack.', tags: ['glass'], polarity: 'support' },
      ],
    });
    expect(fresh.map((l) => l.id)).toEqual(['L-2', 'L-3']);
    expect(m.storedLessons()).toHaveLength(3);
  });

  it('caps episode keys', () => {
    const m = new CrewMemory(dir);
    for (let i = 0; i < 60; i += 1) m.addCritique({ episodeKey: `e${i}`, worked: [], failed: [], lessons: [BOWL_LESSON] });
    const [l] = m.storedLessons();
    expect(l?.support).toBe(60);
    expect(l?.episodeKeys).toHaveLength(50);
    expect(l?.episodeKeys[49]).toBe('e59');
  });

  it('computes placement statistics and observed lessons, including left-out items', () => {
    const m = new CrewMemory(dir);
    m.recordEpisode(episode('e1', [item('soup_plate'), item('soup_plate', { clean: false }), item('cup', { loaded: false, clean: false, rack: null, stance: null })]));
    m.recordEpisode(episode('e2', [item('soup_plate'), item('cup', { loaded: false, clean: false, rack: null, stance: null }), item('cup', { rack: null, stance: null })]));
    expect(m.placementStats()).toEqual([
      { kind: 'cup', rack: 'left_out', stance: 'unknown', n: 2, clean: 0, rate: 0 },
      { kind: 'cup', rack: 'unknown', stance: 'unknown', n: 1, clean: 1, rate: 1 },
      { kind: 'soup_plate', rack: 'lower_rack', stance: 'upright', n: 3, clean: 2, rate: 2 / 3 },
    ]);
    const observed = m.observedLessons();
    expect(observed.map((l) => l.id)).toEqual(['O-cup-left_out-unknown', 'O-soup_plate-lower_rack-upright']);
    expect(observed[1]).toMatchObject({
      text: 'soup_plate in lower_rack standing upright: clean 2 of 3 (67%)',
      tags: ['soup_plate', 'lower_rack', 'upright'],
      source: 'observed', support: 2, contradict: 1, episodeKeys: ['e1', 'e2'],
    });
    expect(observed[0]?.text).toBe('cup left out (not loaded): 2 times');
    expect(m.lessons().map((l) => l.id)).toEqual(['O-cup-left_out-unknown', 'O-soup_plate-lower_rack-upright']);
  });

  it('keeps exam episodes out of statistics, lessons and briefs', () => {
    const m = new CrewMemory(dir);
    m.recordEpisode(episode('e1', [item('bowl'), item('bowl')]));
    const before = { stats: m.placementStats(), lessons: m.lessons(), brief: m.briefFor({ kinds: ['bowl', 'cup'], soils: [] }, 5) };
    m.recordEpisode(episode('x1', [item('bowl', { clean: false }), item('cup'), item('cup')], 'exam-baseline'));
    m.recordEpisode(episode('x2', [item('cup'), item('cup')], 'exam-champion'));
    m.recordEpisode(episode('t1', [item('cup'), item('cup')], 'eval', { split: 'test' }));
    for (const mem of [m, new CrewMemory(dir)]) {
      expect(mem.placementStats()).toEqual(before.stats);
      expect(mem.lessons()).toEqual(before.lessons);
      expect(mem.briefFor({ kinds: ['bowl', 'cup'], soils: [] }, 5)).toBe(before.brief);
      expect(mem.episodes().map((e) => e.episodeKey)).toEqual(['e1']);
      expect(mem.examEpisodes().map((e) => e.episodeKey)).toEqual(['x1', 'x2', 't1']);
    }
    expect(readFileSync(join(dir, 'episodes.jsonl'), 'utf8')).not.toContain('"x1"');
  });

  it('filters episodes by genome and split, and replaces a re-recorded key', () => {
    const m = new CrewMemory(dir);
    m.recordEpisode(episode('e1', [item('bowl')], 'train', { genomeId: 'g0' }));
    m.recordEpisode(episode('e2', [item('bowl')], 'eval', { genomeId: 'g1' }));
    m.recordEpisode(episode('e1', [item('bowl', { clean: false })], 'train', { genomeId: 'g0' }));
    expect(m.episodes({ genomeId: 'g1' }).map((e) => e.episodeKey)).toEqual(['e2']);
    expect(m.episodes({ split: 'train' })).toHaveLength(2);
    expect(m.placementStats()[0]).toMatchObject({ n: 2, clean: 1 });
  });

  it('writes a relevant, ranked, deterministic brief', () => {
    const m = new CrewMemory(dir, { now: clock });
    m.recordEpisode(episode('e1', [item('bowl', { rack: 'upper_rack', stance: 'mouth_down' }), item('bowl', { stance: 'mouth_up', clean: false })]));
    m.recordEpisode(episode('e2', [item('bowl', { rack: 'upper_rack', stance: 'mouth_down' }), item('bowl', { stance: 'mouth_up', clean: false })]));
    m.addCritique({ episodeKey: 'e1', worked: [], failed: [], lessons: [BOWL_LESSON] });
    m.addCritique({ episodeKey: 'e2', worked: [], failed: [], lessons: [BOWL_LESSON] });
    m.addCritique({
      episodeKey: 'e1', worked: [], failed: [],
      lessons: [
        { text: 'Check the load before starting the cycle.', tags: ['general'], polarity: 'support' },
        { text: 'Wine glasses go in the upper rack on the tines.', tags: ['wine_glass'], polarity: 'support' },
        { text: 'Spoons nest together and stay dirty.', tags: ['spoon'], polarity: 'contradict' },
      ],
    });
    const brief = m.briefFor({ kinds: ['bowl', 'cup'], soils: ['porridge'] }, 5);
    expect(brief).toContain('- bowl: best upper_rack/mouth_down 2/2 (100%); worst lower_rack/mouth_up 0/2 (0%)');
    expect(brief).toContain('- cup: no record yet');
    expect(brief).toContain('[L-1 ');
    expect(brief).toContain('[L-2 ');
    expect(brief).not.toContain('Wine glasses');
    expect(brief).not.toContain('Spoons'); // contradicted, not advice
    expect(brief.indexOf('[L-1 ')).toBeLessThan(brief.indexOf('[L-2 '));
    expect(brief.length).toBeLessThanOrEqual(2500);
    expect(m.briefFor({ kinds: ['cup', 'bowl'], soils: ['porridge'] }, 5)).toBe(brief);
    expect(new CrewMemory(dir).briefFor({ kinds: ['bowl', 'cup'], soils: ['porridge'] }, 5)).toBe(brief);
    expect(m.briefFor({ kinds: ['bowl'], soils: [] }, 1).match(/\[L-/g)).toHaveLength(1);
  });

  it('keeps a brief under the length limit', () => {
    const m = new CrewMemory(dir);
    const kinds = Array.from({ length: 80 }, (_, i) => `kind_number_${i}`);
    m.recordEpisode(episode('e1', kinds.map((k) => item(k))));
    for (let i = 0; i < 40; i += 1) {
      m.addCritique({ episodeKey: `e${i}`, worked: [], failed: [], lessons: [{ text: `Lesson ${i} ${'about something specific '.repeat(4)} ${i}x${i}y`, tags: [`k${i}`, 'general'], polarity: 'support' }] });
    }
    expect(m.briefFor({ kinds, soils: [] }, 40).length).toBeLessThanOrEqual(2500);
  });

  it('selects the champion, then accepted, then baseline', () => {
    const m = new CrewMemory(dir);
    m.saveGenome(genome('g0'), 'baseline');
    expect(m.champion()?.id).toBe('g0');
    m.saveGenome(genome('g1'), 'candidate');
    expect(m.champion()?.id).toBe('g0');
    m.saveGenome(genome('g1'), 'accepted');
    expect(m.champion()?.id).toBe('g1');
    m.saveGenome(genome('g2'), 'candidate');
    m.saveGenome(genome('g2'), 'champion');
    m.saveGenome(genome('g3'), 'accepted');
    expect(m.champion()?.id).toBe('g2');
    m.saveGenome(genome('g2'), 'rejected');
    expect(m.champion()?.id).toBe('g3');
    expect(m.genomes().map((g) => `${g.genome.id}:${g.status}`)).toEqual(['g0:baseline', 'g1:accepted', 'g2:rejected', 'g3:accepted']);
    expect(new CrewMemory(dir).champion()?.id).toBe('g3');
  });

  it('snapshots, forks and resets', () => {
    const m = new CrewMemory(dir, { now: clock });
    m.recordEpisode(episode('e1', [item('bowl'), item('bowl')]));
    m.addCritique({ episodeKey: 'e1', worked: [], failed: [], lessons: [BOWL_LESSON] });
    const snap = m.snapshot(1);
    expect(snap.topLessons).toHaveLength(1);
    expect(snap.stats.episodes).toBe(1);
    expect(snap.placementStats).toHaveLength(1);

    const copy = m.fork(join(root, 'frozen'));
    expect(copy.lessons()).toEqual(m.lessons());
    copy.recordEpisode(episode('e2', [item('cup')]));
    expect(m.episodes()).toHaveLength(1);
    expect(() => m.fork(join(root, 'frozen'))).toThrow(/not empty/);

    const backup = m.reset();
    expect(backup).toBe(`${dir}.bak-2026-10-17T12-00-00-000Z`);
    expect(existsSync(join(backup, 'episodes.jsonl'))).toBe(true);
    expect(m.stats()).toEqual({ episodes: 0, lessons: 0, genomes: 0, decisions: 0, examEpisodes: 0 });
    expect(new CrewMemory(dir).episodes()).toHaveLength(0);
  });
});
