import { describe, expect, it } from 'vitest';
import { fakeRun } from '../scripts/fake-events.ts';
import { diffGenomes } from './diff.ts';
import { championId, evolution, foldEvents, initialState, lineage, liveEpisodes, reduce } from './state.ts';

describe('studio reducer', () => {
  const events = fakeRun();
  const s = foldEvents(events);

  it('does not mutate the previous state', () => {
    const s0 = initialState();
    const frozen = JSON.stringify(s0);
    reduce(s0, events[0]!);
    expect(JSON.stringify(s0)).toBe(frozen);
  });

  it('folds a whole run: phases, episodes, decisions, exam', () => {
    expect(s.seq).toBe(events.length);
    expect(s.run?.mode).toBe('evolve');
    expect(s.phase?.phase).toBe('done');
    expect(s.decisions.map((d) => d.accepted)).toEqual([true, false]);
    expect(Object.values(s.episodes).every((e) => e.summary !== null)).toBe(true);
    expect(s.tokens.in).toBeGreaterThan(0);
    expect(s.exam && s.exam.champion.share > s.exam.baseline.share).toBe(true);
    expect(championId(s)).toBe('g1-mouthdown');
    expect(liveEpisodes(s, Date.parse(s.lastAt!) + 60_000, 5000)).toHaveLength(0);
  });

  it('derives the evolution line and the lineage', () => {
    const pts = evolution(s);
    expect(pts).toHaveLength(3);
    expect(pts[1]!.champion).toBe(pts[1]!.candidate);
    expect(lineage(s).map((n) => [n.id, n.depth])).toEqual([
      ['g0-baseline', 0],
      ['g1-mouthdown', 1],
      ['g2-noplanner', 2],
    ]);
  });

  it('starts over on a new run id', () => {
    const again = reduce(s, { ...events[0]!, runId: 'other' } as (typeof events)[number]);
    expect(again.runId).toBe('other');
    expect(again.episodeOrder).toHaveLength(0);
  });

  it('diffs genomes', () => {
    const g0 = s.genomes['g0-baseline']!.genome;
    const g1 = s.genomes['g1-mouthdown']!.genome;
    const kinds = diffGenomes(g0, g1).map((d) => d.kind);
    expect(kinds).toContain('rule_added');
    expect(kinds).toContain('rule_edited');
    expect(kinds).toContain('prompt');
    expect(kinds).toContain('team');
  });
});
