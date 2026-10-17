/**
 * The Gatekeeper: a candidate and the incumbent play the same fresh validation tasks; the candidate
 * is kept only if its mean share beats the incumbent's by a margin and it fails no more episodes.
 */

import type { Decision, EpisodeSummary } from './contracts.ts';

export const DEFAULT_MARGIN = Number(process.env['CREW_MARGIN'] ?? '0.03');

export function decide(o: {
  candidateId: string;
  incumbentId: string;
  proposalTitle: string;
  incumbent: readonly EpisodeSummary[];
  candidate: readonly EpisodeSummary[];
  margin?: number;
  at?: string;
}): Decision {
  const margin = o.margin ?? DEFAULT_MARGIN;
  const byTask = new Map<string, { incumbent: number; candidate: number }>();
  for (const s of o.incumbent) byTask.set(s.taskId, { incumbent: s.failed ? 0 : s.share, candidate: 0 });
  for (const s of o.candidate) {
    const row = byTask.get(s.taskId) ?? { incumbent: 0, candidate: 0 };
    row.candidate = s.failed ? 0 : s.share;
    byTask.set(s.taskId, row);
  }
  const perTask = [...byTask.entries()].map(([taskId, v]) => ({ taskId, ...v }));
  const mean = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
  const incumbentScore = mean(perTask.map((t) => t.incumbent));
  const candidateScore = mean(perTask.map((t) => t.candidate));
  const delta = candidateScore - incumbentScore;
  const failsI = o.incumbent.filter((s) => s.failed).length;
  const failsC = o.candidate.filter((s) => s.failed).length;
  const wins = perTask.filter((t) => t.candidate > t.incumbent).length;
  const losses = perTask.filter((t) => t.candidate < t.incumbent).length;
  let accepted = delta >= margin && failsC <= failsI;
  let reason: string;
  if (failsC > failsI) {
    accepted = false;
    reason = `candidate failed ${failsC} episode(s), incumbent ${failsI}`;
  } else if (delta >= margin) reason = `mean share +${delta.toFixed(3)} >= margin ${margin} (${wins} wins, ${losses} losses)`;
  else reason = `mean share ${delta >= 0 ? '+' : ''}${delta.toFixed(3)} < margin ${margin} (${wins} wins, ${losses} losses)`;
  return { candidateId: o.candidateId, incumbentId: o.incumbentId, proposalTitle: o.proposalTitle, accepted, incumbentScore, candidateScore, delta, perTask, reason, at: o.at ?? new Date().toISOString() };
}
