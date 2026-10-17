import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { EpisodeTools, ToolOutcome } from '@spotless/bench';
import { scriptedProvider } from '@spotless/bench';
import { EventBus } from './bus.ts';
import type { EpisodeSummary } from './contracts.ts';
import { extractJSON } from './crusoe.ts';
import { decide } from './gatekeeper.ts';
import { applyEdits, baselineGenome, diffGenomes } from './genome.ts';
import { wrapProvider, wrapTools } from './loader-policy.ts';
import { stanceOf } from './stance.ts';
import { testTasks, trainTasks } from './tasks.ts';

const base = baselineGenome({ loader: 'm' }, '2026-01-01T00:00:00Z');

describe('genome', () => {
  it('applies edits deterministically and diffs them', () => {
    const p = { id: 'P1', title: 't', hypothesis: 'h', edits: [{ op: 'add_rule', rule: { text: 'Bowls mouth down', tags: ['bowl'], evidence: [] } }, { op: 'set_team', key: 'preflightCheck', value: true }, { op: 'remove_rule', id: 'nope' }] } as const;
    const a = applyEdits(base, p, 'x');
    const b = applyEdits(base, p, 'x');
    expect(a.genome.id).toBe(b.genome.id);
    expect(a.genome.id).toMatch(/^G1-/);
    expect(a.genome.playbook[0]?.id).toBe('R1.1');
    expect(a.rejected).toHaveLength(1);
    expect(diffGenomes(base, a.genome)).toEqual(['team.preflightCheck: false -> true', '+ rule R1.1: Bowls mouth down']);
  });
});

describe('tasks', () => {
  it('is deterministic and the splits are disjoint', () => {
    expect(trainTasks(3, 5).map((t) => t.id)).toEqual(trainTasks(3, 5).map((t) => t.id));
    const train = new Set(trainTasks(8, 0).map((t) => t.sourceLevelId));
    for (const t of testTasks(6, 0)) expect(train.has(t.sourceLevelId)).toBe(false);
  });
});

describe('stance', () => {
  it('classifies the tutorial poses', () => {
    expect(stanceOf('cereal_bowl_porcelain_160', [0.0052, 0.9913, 0.0496, -0.1216])).toBe('mouth_down');
    expect(stanceOf('dinner_plate_porcelain_270', [0.4939, 0.5045, 0.5277, 0.4723])).toBe('on_edge');
    expect(stanceOf('dinner_fork_185', [0.634, -0.0089, -0.7732, 0.0108])).toBe('upright');
  });
});

describe('loader policy', () => {
  it('refuses start_cycle before check_load under preflight, and injects the system text', async () => {
    const g = applyEdits(base, { id: 'p', title: 't', hypothesis: '', edits: [{ op: 'set_team', key: 'preflightCheck', value: true }, { op: 'add_rule', rule: { text: 'RULE-XYZ', tags: [], evidence: [] } }] }).genome;
    const made: string[] = [];
    const ok: ToolOutcome = { structured: { accepted: true }, text: '{"accepted":true}', images: [], isError: false };
    const raw = { calls: [], list: async () => [], resource: async () => '', call: async (name: string) => (made.push(name), ok) } as unknown as EpisodeTools;
    const trace = { locations: new Map(), notes: [], refusedStarts: 0 };
    const tools = wrapTools(raw, { genome: g, bus: null, episodeKey: 'k', trace });
    await tools.call('place', {});
    const refused = await tools.call('start_cycle', {});
    expect(refused.structured?.['reason']).toBe('preflight_required');
    await tools.call('check_load', {});
    await tools.call('start_cycle', {});
    expect(made).toEqual(['place', 'check_load', 'render', 'render', 'start_cycle']);
    const inner = scriptedProvider([{ say: 'hi' }]);
    const p = wrapProvider(inner, { extra: 'RULE-XYZ', images: true, bus: null, episodeKey: 'k', trace });
    await p.complete({ system: 'SYS', tools: [], history: [] });
    expect(inner.requests[0]?.system).toContain('RULE-XYZ');
  });
});

describe('gatekeeper and bus', () => {
  const s = (taskId: string, share: number, failed = false): EpisodeSummary => ({ taskId, share, failed }) as EpisodeSummary;
  it('accepts only past the margin and without more failures', () => {
    expect(decide({ candidateId: 'c', incumbentId: 'i', proposalTitle: 't', incumbent: [s('a', 0.5), s('b', 0.5)], candidate: [s('a', 0.6), s('b', 0.5)], margin: 0.03 }).accepted).toBe(true);
    expect(decide({ candidateId: 'c', incumbentId: 'i', proposalTitle: 't', incumbent: [s('a', 0.5)], candidate: [s('a', 0.51)], margin: 0.03 }).accepted).toBe(false);
    expect(decide({ candidateId: 'c', incumbentId: 'i', proposalTitle: 't', incumbent: [s('a', 0.2), s('b', 0.2)], candidate: [s('a', 0.9), s('b', 0, true)], margin: 0.03 }).accepted).toBe(false);
  });
  it('persists events', () => {
    const dir = mkdtempSync(join(tmpdir(), 'crew-'));
    const bus = new EventBus('r', dir);
    bus.log('hello');
    expect(JSON.parse(readFileSync(join(dir, 'events.jsonl'), 'utf8').trim()).text).toBe('hello');
  });
  it('extracts JSON from fenced prose', () => {
    expect(extractJSON('Sure!\n```json\n{"a": {"b": 1}}\n```')).toEqual({ a: { b: 1 } });
    expect(extractJSON('x {"a": "}"} y')).toEqual({ a: '}' });
  });
});
