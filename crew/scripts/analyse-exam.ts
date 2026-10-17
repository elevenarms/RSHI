/**
 * Paired analysis of exam runs (baseline vs champion on the same held-out drills): mean delta,
 * per-drill wins, exact sign test, Wilcoxon signed-rank, bootstrap 95% CI.
 *
 *   tsx scripts/analyse-exam.ts <runDir> [<runDir> ...]
 */
import { readEvents } from '../src/bus.ts';
import { bootstrap, mean, signTest, wilcoxon } from './stats.ts';

const pairs: { run: string; task: string; base: number; champ: number; baseFailed: boolean; champFailed: boolean }[] = [];
for (const dir of process.argv.slice(2)) {
  const fin = readEvents(dir).filter((e: any) => e.type === 'episode_finished').map((e: any) => e.summary);
  const by = new Map<string, { b?: any; c?: any }>();
  for (const s of fin) {
    const e = by.get(s.taskId) ?? {};
    if (s.purpose === 'exam-baseline') e.b ??= s;
    if (s.purpose === 'exam-champion') e.c ??= s;
    by.set(s.taskId, e);
  }
  for (const [task, e] of by) if (e.b !== undefined && e.c !== undefined) pairs.push({ run: dir.split('/').pop() as string, task, base: e.b.share, champ: e.c.share, baseFailed: e.b.failed, champFailed: e.c.failed });
}
const valid = pairs.filter((p) => !p.baseFailed && !p.champFailed);
const diffs = valid.map((p) => p.champ - p.base);
const st = signTest(diffs);
const w = wilcoxon(diffs);
const ci = bootstrap(valid, (s) => mean(s.map((p) => p.champ - p.base)));
console.log(`pairs ${pairs.length} (valid ${valid.length}) over ${new Set(pairs.map((p) => p.run)).size} run(s), drills ${new Set(pairs.map((p) => p.task)).size}`);
console.log(`mean share: baseline ${mean(valid.map((p) => p.base)).toFixed(3)}, champion ${mean(valid.map((p) => p.champ)).toFixed(3)}, delta ${mean(diffs) >= 0 ? '+' : ''}${mean(diffs).toFixed(3)}, bootstrap 95% CI [${ci.map((x) => x.toFixed(3)).join(', ')}]`);
console.log(`champion wins ${st.wins}, losses ${st.losses}, ties ${st.ties}; sign test p = ${st.p.toFixed(3)}; Wilcoxon W = ${w.W} (n = ${w.n}), p = ${w.p.toFixed(3)}`);
const bySource = new Map<string, number[]>();
for (const p of valid) {
  const src = p.task.replace(/^drill-/, '').replace(/-12-s\d+$/, '');
  bySource.set(src, [...(bySource.get(src) ?? []), p.champ - p.base]);
}
for (const [src, ds] of bySource) console.log(`  ${src}: ${ds.length} pairs, mean delta ${mean(ds) >= 0 ? '+' : ''}${mean(ds).toFixed(3)}, wins ${ds.filter((d) => d > 0).length}/${ds.length}`);
console.log('| run | drill | baseline | champion | delta |\n|---|---|---|---|---|');
for (const p of pairs) console.log(`| ${p.run.slice(11, 19)} | ${p.task} | ${p.base.toFixed(3)}${p.baseFailed ? ' (invalid)' : ''} | ${p.champ.toFixed(3)}${p.champFailed ? ' (invalid)' : ''} | ${(p.champ - p.base >= 0 ? '+' : '')}${(p.champ - p.base).toFixed(3)} |`);
