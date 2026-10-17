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

describe('image caps', () => {
  it('keeps only the newest pictures', async () => {
    const { capImages } = await import('./crusoe.ts');
    const img = { type: 'image_url', image_url: { url: 'data:x' } };
    const out = capImages([{ role: 'user', content: [{ type: 'text', text: 'a' }, img] }, { role: 'tool', content: 'r' }, { role: 'user', content: [img, img] }], 1);
    const count = JSON.stringify(out).split('image_url').length - 1;
    expect(count).toBe(2); // one part: type + key
    expect(out[0].content[1].type).toBe('text');
    expect(out[2].content[1].type).toBe('image_url');
    expect(out[2].content[0].type).toBe('text');
  });
});

describe('rate limiter', () => {
  it('holds a sliding window of CREW_RPM and at most CREW_MAX_INFLIGHT at once', async () => {
    const { crusoeChat, fakeStats } = await import('./crusoe.ts');
    process.env['CREW_FAKE'] = '1';
    process.env['CREW_RPM'] = '6';
    process.env['CREW_MAX_INFLIGHT'] = '2';
    process.env['CREW_FAKE_MS'] = '30';
    let done = 0;
    const calls = Array.from({ length: 10 }, () => crusoeChat({ model: 'limiter-test', messages: [] }).then(() => (done += 1)));
    await new Promise((r) => setTimeout(r, 400));
    expect(done).toBe(6);
    expect(fakeStats.maxInflight).toBeLessThanOrEqual(2);
    void calls;
    delete process.env['CREW_FAKE'];
    delete process.env['CREW_FAKE_MS'];
  });
  it('voids a comparison with too few valid pairs and ignores invalid episodes', () => {
    const s = (taskId: string, share: number, failed = false): EpisodeSummary => ({ taskId, share, failed, stopped: failed ? 'provider_error' : 'start_cycle' }) as EpisodeSummary;
    const v = decide({ candidateId: 'c', incumbentId: 'i', proposalTitle: 't', incumbent: [s('a', 0.5), s('b', 0.5, true), s('c', 0.5, true)], candidate: [s('a', 0.9), s('b', 0.5), s('c', 0.5)] });
    expect(v.void).toBe(true);
    const ok = decide({ candidateId: 'c', incumbentId: 'i', proposalTitle: 't', incumbent: [s('a', 0.5), s('b', 0.5), s('c', 0.5), s('d', 0.1, true)], candidate: [s('a', 0.6), s('b', 0.6), s('c', 0.6), s('d', 0)], margin: 0.03 });
    expect(ok.accepted).toBe(true);
    expect(ok.perTask).toHaveLength(3);
  });
});

describe('call log and archive', () => {
  it('rebuilds loader requests from keep + tail, and finds secrets', async () => {
    const { mkdtempSync, readFileSync } = await import('node:fs');
    const { setCallLog, logCall, reconstructRequests } = await import('./calllog.ts');
    const { scanForSecrets } = await import('./archive.ts');
    const dir = mkdtempSync(join(tmpdir(), 'calls-'));
    const file = join(dir, 'calls.jsonl');
    setCallLog(file);
    const sys = { role: 'system', content: 'SYS' };
    const m1 = [sys, { role: 'user', content: 'a' }];
    const m2 = [...m1, { role: 'assistant', content: 'b' }, { role: 'user', content: 'c' }];
    const m3 = [sys, { role: 'user', content: 'folded' }, { role: 'user', content: 'd' }];
    const base = { role: 'loader', model: 'm', episodeKey: 'e', startedAt: new Date().toISOString(), endedAt: new Date().toISOString(), ms: 1, attempts: 1, throttled: 0, reply: { choices: [{ message: { content: 'x' } }] } };
    for (const messages of [m1, m2, m3]) logCall({ ...base, body: { model: 'm', messages } });
    logCall({ ...base, role: 'critic', episodeKey: undefined as unknown as string, body: { model: 'm', messages: m1 } });
    setCallLog(null);
    const rebuilt = reconstructRequests(readFileSync(file, 'utf8'));
    expect(rebuilt.map((r) => r.messages)).toEqual([m1, m2, m3, m1]);
    expect(() => scanForSecrets('{"authorization": "Bearer x"}', 'f')).toThrow();
    expect(() => scanForSecrets('{"auth_header": "none"}', 'f')).not.toThrow();
  });
});
