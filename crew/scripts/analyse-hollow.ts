/** Analysis of physics-hollow results: per achieved stance, and mouth-down vs mouth-up paired by instance. */
import { readFileSync, writeFileSync } from 'node:fs';
import { bootstrap, mean, oddsRatio } from './stats.ts';

const file = process.argv[2] as string;
const rows = (JSON.parse(readFileSync(file, 'utf8')) as any[]).filter((r) => r.washed && r.achieved !== null);

const group = (s: string): string =>
  s === 'mouth_up' || s.startsWith('mouth_up_tilted') ? 'mouth_up' : s === 'mouth_down' ? 'mouth_down_0' : s.startsWith('mouth_down_tilted_') ? `mouth_down_${s.split('_').pop()}` : s;

const by = new Map<string, any[]>();
for (const r of rows) by.set(group(r.achieved), [...(by.get(group(r.achieved)) ?? []), r]);
const lines: string[] = [];
const say = (s: string): void => {
  lines.push(s);
  console.log(s);
};
say(`washes ${rows.length} (achieved stance), instances ${new Set(rows.map((r) => r.instance)).size}, kinds ${new Set(rows.map((r) => r.kind)).size}`);
say('| achieved stance | n | P(clean) | residual mass fraction (mean) | retained water ml (mean) | holds water |');
say('|---|---|---|---|---|---|');
for (const [g, rs] of [...by.entries()].sort()) {
  say(`| ${g} | ${rs.length} | ${(100 * mean(rs.map((r) => (r.clean ? 1 : 0)))).toFixed(0)}% | ${mean(rs.map((r) => r.residual_mass_fraction ?? 0)).toFixed(4)} | ${mean(rs.map((r) => r.retained_water_ml ?? 0)).toFixed(0)} | ${(100 * mean(rs.map((r) => (r.holds_water ? 1 : 0)))).toFixed(0)}% |`);
}

// Paired by instance: the best mouth-down variant reached (0 first) vs mouth up.
const inst = new Map<string, { up?: any; down: any[] }>();
for (const r of rows) {
  const g = group(r.achieved);
  const e = inst.get(r.instance) ?? { down: [] };
  if (g === 'mouth_up' && e.up === undefined) e.up = r;
  if (g.startsWith('mouth_down')) e.down.push(r);
  inst.set(r.instance, e);
}
const pairs = [...inst.entries()].filter(([, e]) => e.up !== undefined && e.down.length > 0).map(([k, e]) => ({ k, up: e.up, down: e.down }));
const downAll = pairs.flatMap((p) => p.down);
const upAll = pairs.map((p) => p.up);
const pc = (xs: any[]): number => mean(xs.map((r) => (r.clean ? 1 : 0)));
const resid = (xs: any[]): number => mean(xs.map((r) => r.residual_mass_fraction ?? 0));
const water = (xs: any[]): number => mean(xs.map((r) => r.retained_water_ml ?? 0));
say(`\npaired instances (both mouth up and some mouth down reached): ${pairs.length}`);
const a = downAll.filter((r) => r.clean).length, b = downAll.length - a, c = upAll.filter((r) => r.clean).length, d = upAll.length - c;
const ciP = (f: (p: (typeof pairs)[number]) => number) => bootstrap(pairs, (s) => mean(s.map(f)));
const dClean = (p: (typeof pairs)[number]) => pc(p.down) - (p.up.clean ? 1 : 0);
const dResid = (p: (typeof pairs)[number]) => resid([p.up]) - resid(p.down);
const dWater = (p: (typeof pairs)[number]) => water([p.up]) - water(p.down);
const residReduction = (s: readonly (typeof pairs)[number][]) => 1 - mean(s.map((p) => resid(p.down))) / mean(s.map((p) => resid([p.up])));
say(`P(clean): mouth down ${(100 * pc(downAll)).toFixed(0)}% (${a}/${downAll.length}) vs mouth up ${(100 * pc(upAll)).toFixed(0)}% (${c}/${upAll.length}); odds ratio ${oddsRatio(a, b, c, d).toFixed(1)}; paired difference ${(100 * mean(pairs.map(dClean))).toFixed(0)} pp, 95% CI [${ciP(dClean).map((x) => (100 * x).toFixed(0)).join(', ')}] pp`);
say(`residual soil (mass fraction): mouth up ${resid(upAll).toFixed(4)} vs mouth down ${resid(downAll).toFixed(4)}: reduced by ${(100 * residReduction(pairs)).toFixed(0)}%, 95% CI [${bootstrap(pairs, residReduction).map((x) => (100 * x).toFixed(0)).join(', ')}]%`);
say(`water retained: mouth up ${water(upAll).toFixed(0)} ml vs mouth down ${water(downAll).toFixed(1)} ml per item; difference ${mean(pairs.map(dWater)).toFixed(0)} ml, 95% CI [${ciP(dWater).map((x) => x.toFixed(0)).join(', ')}]`);
void dResid;
say('\nper kind (mouth up vs mouth down: clean, residual, water):');
for (const kind of [...new Set(pairs.map((p) => p.up.kind))]) {
  const ps = pairs.filter((p) => p.up.kind === kind);
  say(`- ${kind}: up clean ${ps.filter((p) => p.up.clean).length}/${ps.length}, resid ${resid(ps.map((p) => p.up)).toFixed(4)}, water ${water(ps.map((p) => p.up)).toFixed(0)} ml | down clean ${ps.flatMap((p) => p.down).filter((r) => r.clean).length}/${ps.flatMap((p) => p.down).length}, resid ${resid(ps.flatMap((p) => p.down)).toFixed(4)}, water ${water(ps.flatMap((p) => p.down)).toFixed(1)} ml`);
}
writeFileSync(file.replace(/\.json$/, '.analysis.md'), `${lines.join('\n')}\n`);
