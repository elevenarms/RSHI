/**
 * The Gatekeeper: a candidate and the incumbent play the same fresh validation tasks; the candidate
 * is kept only if its mean share beats the incumbent's by a margin and it fails no more episodes.
 */

import type { Decision, EpisodeSummary } from './contracts.ts';

export const DEFAULT_MARGIN = Number(process.env['CREW_MARGIN'] ?? '0.03');

/** An episode that has no result through no fault of the agent (API failure, harness error). */
export function isInvalid(s: Pick<EpisodeSummary, 'failed' | 'stopped'>): boolean {
  return s.failed;
}

export const MIN_VALID_PAIRS = Number(process.env['CREW_MIN_VALID_PAIRS'] ?? '3');

/**
 * Paired comparison on the tasks both genomes played validly. Invalid episodes (infrastructure)
 * are excluded for both sides; agent failures (turn limit, token budget, nothing loaded) score
 * what they scored. Fewer than `minValid` valid pairs (at most the number of tasks): void.
 */
export function decide(o: {
  candidateId: string;
  incumbentId: string;
  proposalTitle: string;
  incumbent: readonly EpisodeSummary[];
  candidate: readonly EpisodeSummary[];
  margin?: number;
  minValid?: number;
  at?: string;
}): Decision {
  const margin = o.margin ?? DEFAULT_MARGIN;
  const valid = (xs: readonly EpisodeSummary[]): Map<string, number> => {
    const m = new Map<string, number>();
    for (const s of xs) if (!isInvalid(s)) m.set(s.taskId, s.share);
    return m;
  };
  const vi = valid(o.incumbent);
  const vc = valid(o.candidate);
  const tasks = new Set([...o.incumbent, ...o.candidate].map((s) => s.taskId));
  const perTask = [...tasks].filter((t) => vi.has(t) && vc.has(t)).map((taskId) => ({ taskId, incumbent: vi.get(taskId) as number, candidate: vc.get(taskId) as number }));
  const excluded = tasks.size - perTask.length;
  const need = Math.min(o.minValid ?? MIN_VALID_PAIRS, tasks.size);
  const mean = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
  const incumbentScore = mean(perTask.map((t) => t.incumbent));
  const candidateScore = mean(perTask.map((t) => t.candidate));
  const delta = candidateScore - incumbentScore;
  const at = o.at ?? new Date().toISOString();
  const base = { candidateId: o.candidateId, incumbentId: o.incumbentId, proposalTitle: o.proposalTitle, incumbentScore, candidateScore, delta, perTask, at };
  if (perTask.length < need) {
    return { ...base, accepted: false, void: true, reason: `void: only ${perTask.length} valid paired task(s) of ${tasks.size} (need ${need}); ${excluded} excluded for infrastructure failures` };
  }
  const wins = perTask.filter((t) => t.candidate > t.incumbent).length;
  const losses = perTask.filter((t) => t.candidate < t.incumbent).length;
  const accepted = delta >= margin;
  const tail = `(${wins} wins, ${losses} losses on ${perTask.length} paired tasks${excluded > 0 ? `, ${excluded} excluded as invalid` : ''})`;
  const reason = accepted ? `mean share +${delta.toFixed(3)} >= margin ${margin} ${tail}` : `mean share ${delta >= 0 ? '+' : ''}${delta.toFixed(3)} < margin ${margin} ${tail}`;
  return { ...base, accepted, reason };
}
