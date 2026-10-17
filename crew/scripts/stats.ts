/** Small statistics for the research scripts: paired tests, bootstrap, odds ratio. */

import { rng } from '../src/tasks.ts';

export const mean = (xs: readonly number[]): number => (xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length);

function binom(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** Two-sided exact sign test on paired differences (ties dropped). */
export function signTest(diffs: readonly number[]): { wins: number; losses: number; ties: number; p: number } {
  const wins = diffs.filter((d) => d > 0).length;
  const losses = diffs.filter((d) => d < 0).length;
  const n = wins + losses;
  const k = Math.min(wins, losses);
  let tail = 0;
  for (let i = 0; i <= k; i++) tail += binom(n, i) / 2 ** n;
  return { wins, losses, ties: diffs.length - n, p: n === 0 ? 1 : Math.min(1, 2 * tail) };
}

/** Wilcoxon signed-rank, two-sided: exact for n <= 20 (zeros dropped, ties averaged), else normal. */
export function wilcoxon(diffs: readonly number[]): { n: number; W: number; p: number } {
  const d = diffs.filter((x) => x !== 0);
  const n = d.length;
  if (n === 0) return { n, W: 0, p: 1 };
  const order = d.map((x, i) => ({ a: Math.abs(x), i })).sort((x, y) => x.a - y.a);
  const ranks = new Array<number>(n);
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && order[j + 1]!.a === order[i]!.a) j++;
    for (let k = i; k <= j; k++) ranks[order[k]!.i] = (i + j) / 2 + 1;
    i = j + 1;
  }
  const Wplus = d.reduce((s, x, i) => s + (x > 0 ? ranks[i]! : 0), 0);
  const total = (n * (n + 1)) / 2;
  const W = Math.min(Wplus, total - Wplus);
  if (n <= 20) {
    // Exact distribution over sign assignments of the (possibly tied) ranks, by enumeration of sums.
    const r2 = ranks.map((r) => Math.round(r * 2));
    const max = r2.reduce((a, b) => a + b, 0);
    let dist = new Array<number>(max + 1).fill(0);
    dist[0] = 1;
    for (const r of r2) {
      const next = new Array<number>(max + 1).fill(0);
      for (let s = 0; s <= max; s++) if (dist[s]! > 0) {
        next[s] = (next[s] ?? 0) + dist[s]!;
        if (s + r <= max) next[s + r] = (next[s + r] ?? 0) + dist[s]!;
      }
      dist = next;
    }
    const all = 2 ** n;
    const w2 = Math.round(W * 2);
    let tail = 0;
    for (let s = 0; s <= w2; s++) tail += dist[s]!;
    return { n, W, p: Math.min(1, (2 * tail) / all) };
  }
  const mu = total / 2;
  const sigma = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24);
  const z = (W - mu) / sigma;
  return { n, W, p: Math.min(1, 2 * normCdf(z)) };
}

function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Percentile bootstrap 95% CI of a statistic over resampled units. */
export function bootstrap<T>(units: readonly T[], stat: (sample: readonly T[]) => number, b = 10000, seed = 7): [number, number] {
  const random = rng(seed);
  const out: number[] = [];
  for (let i = 0; i < b; i++) {
    const s = Array.from({ length: units.length }, () => units[Math.floor(random() * units.length)] as T);
    const v = stat(s);
    if (Number.isFinite(v)) out.push(v);
  }
  out.sort((a, c) => a - c);
  return [out[Math.floor(0.025 * out.length)] ?? NaN, out[Math.floor(0.975 * out.length)] ?? NaN];
}

/** Odds ratio with the Haldane 0.5 correction. */
export function oddsRatio(a: number, b: number, c: number, d: number): number {
  return ((a + 0.5) * (d + 0.5)) / ((b + 0.5) * (c + 0.5));
}
