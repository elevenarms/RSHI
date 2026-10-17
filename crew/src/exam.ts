/**
 * The exam: baseline vs champion on held-out test tasks (same tasks, same seeds). Exam episodes go
 * to memory as held-out episodes (memory never learns from them); the critic is not run.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HarnessGame } from '@spotless/bench';
import type { EpisodeSummary, Genome, TaskSpec } from './contracts.ts';
import type { CrewMemory } from './memory/index.ts';
import type { EventBus } from './bus.ts';
import { diffGenomes } from './genome.ts';
import { CONCURRENCY, pool, runTask, type Tier } from './runner.ts';
import { usageTotals } from './crusoe.ts';

export async function exam(o: { baseline: Genome; champion: Genome; tasks: readonly TaskSpec[]; game: HarnessGame; tier: Tier; bus: EventBus; memory: CrewMemory; runId: string; runDir: string; concurrency?: number }): Promise<{ baseline: EpisodeSummary[]; champion: EpisodeSummary[] }> {
  const { bus } = o;
  bus.emit({ type: 'phase', phase: 'exam', generation: o.champion.generation, detail: `${o.baseline.id} vs ${o.champion.id} on ${o.tasks.length} held-out tasks` });
  const jobs = o.tasks.flatMap((task) => [
    { task, genome: o.baseline, purpose: 'exam-baseline' as const },
    { task, genome: o.champion, purpose: 'exam-champion' as const },
  ]);
  const results = await pool(jobs, o.concurrency ?? CONCURRENCY, (j) => runTask({ game: o.game, task: j.task, genome: j.genome, memory: o.memory, bus, purpose: j.purpose, tier: o.tier, runId: o.runId, runDir: o.runDir }));
  const b = results.filter((s) => s.purpose === 'exam-baseline');
  const c = results.filter((s) => s.purpose === 'exam-champion');
  const side = (g: Genome, xs: EpisodeSummary[]) => ({
    genomeId: g.id,
    share: xs.length === 0 ? 0 : xs.reduce((a, s) => a + (s.failed ? 0 : s.share), 0) / xs.length,
    perTask: xs.map((s) => ({ taskId: s.taskId, share: s.share, points: s.points, pointsAvailable: s.pointsAvailable })),
  });
  const exam = { baseline: side(o.baseline, b), champion: side(o.champion, c) };
  bus.emit({ type: 'exam', ...exam });
  writeReport(o, b, c, exam.baseline.share, exam.champion.share);
  bus.emit({ type: 'phase', phase: 'done', generation: o.champion.generation, detail: `exam: baseline ${exam.baseline.share.toFixed(3)} -> champion ${exam.champion.share.toFixed(3)}` });
  return { baseline: b, champion: c };
}

function writeReport(o: { baseline: Genome; champion: Genome; tasks: readonly TaskSpec[]; tier: Tier; memory: CrewMemory; runDir: string }, b: EpisodeSummary[], c: EpisodeSummary[], bs: number, cs: number): void {
  const rate = (xs: EpisodeSummary[]): string => {
    const loaded = xs.flatMap((s) => s.items.filter((i) => i.loaded));
    return loaded.length === 0 ? '-' : `${((100 * loaded.filter((i) => i.clean).length) / loaded.length).toFixed(0)}% (${loaded.filter((i) => i.clean).length}/${loaded.length})`;
  };
  const lines = [
    `# Crew exam report`,
    '',
    `Held-out tasks (test split, never seen in training): ${o.tasks.length}, tier ${o.tier}.`,
    '',
    '| task | baseline | champion | delta |',
    '|---|---|---|---|',
    ...o.tasks.map((t) => {
      const x = b.find((s) => s.taskId === t.id);
      const y = c.find((s) => s.taskId === t.id);
      const f = (s?: EpisodeSummary): string => (s === undefined ? '-' : `${s.points}/${s.pointsAvailable} (${(s.share * 100).toFixed(0)}%)${s.failed ? ' FAILED' : ''}`);
      return `| ${t.title} (\`${t.id}\`) | ${f(x)} | ${f(y)} | ${x && y ? `${((y.share - x.share) * 100).toFixed(0)} pp` : '-'} |`;
    }),
    `| **mean share** | **${(bs * 100).toFixed(1)}%** | **${(cs * 100).toFixed(1)}%** | **${((cs - bs) * 100).toFixed(1)} pp** |`,
    '',
    `Per-item clean rate of loaded items: baseline ${rate(b)}, champion ${rate(c)}.`,
    '',
    `## Genome diff ${o.baseline.id} -> ${o.champion.id}`,
    '',
    ...(diffGenomes(o.baseline, o.champion).map((l) => `- ${l}`) || []),
    '',
    '## Champion playbook',
    '',
    ...o.champion.playbook.map((r) => `- [${r.id}] ${r.text}`),
    '',
    '## Top lessons in memory',
    '',
    ...o.memory.lessons().slice(0, 12).map((l) => `- (${l.confidence.toFixed(2)}) ${l.text}`),
    '',
    '## Decisions',
    '',
    ...o.memory.decisions().map((d) => `- ${d.proposalTitle}: ${d.accepted ? 'accepted' : 'rejected'} (${d.reason})`),
    '',
    '## Token usage per model',
    '',
    ...[...usageTotals.entries()].map(([m, t]) => `- ${m}: ${t.requests} requests, ${t.in} in (${t.cached} cached), ${t.out} out, ${t.retries} retries`),
    '',
  ];
  writeFileSync(join(o.runDir, 'report.md'), lines.join('\n'));
}
