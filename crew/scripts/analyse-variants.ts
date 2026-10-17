/**
 * Variants (ablation / transfer) against the exam's baseline and champion on the same drills:
 * per variant mean share, paired delta vs a reference (per drill; repeats of the reference averaged).
 *
 *   tsx scripts/analyse-variants.ts <variantsRunDir> <examRunDir> [<examRunDir> ...]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readEvents } from '../src/bus.ts';
import { bootstrap, mean, signTest, wilcoxon } from './stats.ts';

const [vdir, ...exams] = process.argv.slice(2) as [string, ...string[]];
const v = JSON.parse(readFileSync(join(vdir, 'variants.json'), 'utf8')) as { set: string; results: { variant: string; taskId: string; share: number; failed: boolean }[] };
const ref = new Map<string, Map<string, number[]>>();
for (const d of exams) {
  for (const e of readEvents(d) as any[]) {
    if (e.type !== 'episode_finished' || e.summary.failed) continue;
    const tag = e.summary.purpose === 'exam-baseline' ? 'baseline' : 'champion';
    const m = ref.get(tag) ?? new Map<string, number[]>();
    m.set(e.summary.taskId, [...(m.get(e.summary.taskId) ?? []), e.summary.share]);
    ref.set(tag, m);
  }
}
const refMean = (tag: string, task: string): number | undefined => {
  const xs = ref.get(tag)?.get(task);
  return xs === undefined ? undefined : mean(xs);
};
console.log(`| variant | n | mean share | vs baseline: delta [95% CI], wins/losses, sign p, Wilcoxon p | vs champion: delta |`);
console.log('|---|---|---|---|---|');
for (const tag of ['baseline', 'champion']) {
  const xs = [...(ref.get(tag)?.values() ?? [])].map(mean);
  console.log(`| (exam ${tag}, mean of repeats) | ${xs.length} | ${mean(xs).toFixed(3)} | | |`);
}
const variants = [...new Set(v.results.map((r) => r.variant))];
for (const id of variants) {
  const rs = v.results.filter((r) => r.variant === id && !r.failed);
  const vs = (tag: string) => rs.flatMap((r) => {
    const b = refMean(tag, r.taskId);
    return b === undefined ? [] : [{ d: r.share - b }];
  });
  const vb = vs('baseline');
  const vc = vs('champion');
  const s = signTest(vb.map((x) => x.d));
  const w = wilcoxon(vb.map((x) => x.d));
  const ci = bootstrap(vb, (x) => mean(x.map((y) => y.d)));
  const f = (x: number): string => `${x >= 0 ? '+' : ''}${x.toFixed(3)}`;
  console.log(`| ${id} | ${rs.length} | ${mean(rs.map((r) => r.share)).toFixed(3)} | ${f(mean(vb.map((x) => x.d)))} [${ci.map(f).join(', ')}], ${s.wins}/${s.losses}, ${s.p.toFixed(2)}, ${w.p.toFixed(2)} | ${f(mean(vc.map((x) => x.d)))} |`);
}
