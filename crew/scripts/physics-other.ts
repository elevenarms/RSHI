/**
 * Controlled physics sweep of the NON-hollow kinds (plates, pans, pots, lids, cutlery, utensils, boards, bakeware), each in every one of its pose presets; derived from physics-hollow.ts. Original header: every hollow kind of the course (bowls, cups, mugs, glasses,
 * tumblers, ramekins, jugs, containers), each instance with its own level soils, washed ALONE in
 * its natural rack at the same slot, in each stance: mouth up, mouth down (0/15/30/45 degree
 * tilt) and on its side. Fast tier, deterministic. Writes <out>/results.json and .csv.
 *
 *   CREW_GAME_SHARDS=4 CREW_GAME_DIR=<dir> tsx scripts/physics-hollow.ts <outDir> [maxPerKind]
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Policy, PolicyOutcome } from '@spotless/bench';
import { runEpisode } from '@spotless/bench';
import { getItemType } from '@spotless/catalogue';
import type { Level, LevelItem } from '@spotless/levels';
import { allLevels, starterRules, validateLevel } from '@spotless/levels';
import type { TaskSpec } from '../src/contracts.ts';
import { closeGames, gameFor, pool } from '../src/runner.ts';
import { stanceOf } from '../src/stance.ts';

const outDir = process.argv[2] ?? '.crew/physics-other';
const maxPerKind = Number(process.argv[3] ?? '1');
mkdirSync(outDir, { recursive: true });

const HOLLOW = /bowl|mug|cup|tumbler|glass_|ramekin|jug|container|bottle|teat/;
const KINDS: { [kind: string]: string } = {};
for (const level of allLevels()) for (const item of level.items) {
  if (HOLLOW.test(item.itemType) || KINDS[item.itemType] !== undefined) continue;
  const zones = getItemType(item.itemType).placement.zones.filter((z) => z !== 'third_rack');
  KINDS[item.itemType] = zones[0] ?? 'lower_rack';
}
interface Condition {
  readonly name: string;
  readonly preset: (poses: Set<string>) => string;
  readonly roll: number;
}
const conditionsOf = (kind: string): Condition[] => getItemType(kind).placement.stablePoses.map((p) => ({ name: p.name, preset: () => p.name, roll: 0 }));
// The instances: per kind, up to maxPerKind distinct soil sets from the course levels.
const instances: { kind: string; source: Level; item: LevelItem }[] = [];
for (const kind of Object.keys(KINDS)) {
  const seen = new Set<string>();
  for (const level of allLevels()) {
    for (const item of level.items) {
      if (item.itemType !== kind) continue;
      const soilKey = item.soils.map((s) => s.type).sort().join('+');
      if (item.soils.length === 0 || seen.has(soilKey) || seen.size >= maxPerKind) continue;
      seen.add(soilKey);
      instances.push({ kind, source: level, item });
    }
  }
}

const tasks: (TaskSpec & { kind: string; condition: Condition; rack: string; instance: string })[] = [];
for (const [n, inst] of instances.entries()) {
  for (const condition of conditionsOf(inst.kind)) {
    const id = `phys-${n}-${condition.name}`.replace(/_/g, '-');
    const level: Level = {
      id,
      title: `${inst.kind} ${condition.name}`,
      summary: 'controlled physics sweep',
      machineId: inst.source.machineId,
      config: inst.source.config,
      racks: inst.source.racks,
      programmeId: inst.source.programmeId,
      items: [{ ...inst.item, id: 'item_01' }],
      rules: starterRules(1),
      seed: inst.source.seed,
      manual: inst.source.manual,
    };
    const problems = validateLevel(level);
    if (problems.length > 0) throw new Error(`${id}: ${problems[0]?.message}`);
    tasks.push({ id, split: 'train', title: level.title, sourceLevelId: inst.source.id, itemCount: 1, pointsAvailable: inst.item.points, level, kind: inst.kind, condition, rack: KINDS[inst.kind] as string, instance: `${inst.source.id}/${inst.item.id}` });
  }
}

function placingPolicy(task: (typeof tasks)[number]): Policy & { placed: { tries: number; accepted: boolean; slot: string | null } } {
  const poses = new Set(getItemType(task.kind).placement.stablePoses.map((p) => p.name));
  const placed = { tries: 0, accepted: false, slot: null as string | null };
  return {
    name: 'physics-sweep',
    kind: 'scripted',
    placed,
    settings: () => ({ condition: task.condition.name }),
    async play(context): Promise<PolicyOutcome> {
      const { tools } = context;
      if (task.rack === 'upper_rack') await tools.call('set_rack', { rack: 'upper_rack', option: { name: 'position', value: 'out' } });
      // The same slot for every stance: the first free slot the game ranks for the item upright.
      const slots = await tools.call('list_slots', { rack: task.rack, item_id: 'item_01', limit: 12 });
      const rows = ((slots.structured?.['places'] as { rows?: unknown[][] } | undefined)?.rows ?? []) as [string, number[], unknown, boolean, string][];
      for (const row of rows.filter((r) => r[3] === true).slice(0, 6)) {
        for (const lift of [0, 25, 50]) {
          placed.tries += 1;
          const args = { item_id: 'item_01', frame: task.rack, position_mm: [row[1][0] as number, row[1][1] as number, (row[1][2] as number) + lift], orientation: { preset: task.condition.name } };
          const r = await tools.call('place', args);
          if (r.structured?.['accepted'] !== true) continue;
          placed.accepted = true;
          placed.slot = `${row[0]} lift ${lift}`;
          await tools.call('start_cycle', {});
          return { stopped: 'done', turns: 0, usage: null, failed: false };
        }
      }
      return { stopped: 'done', detail: 'no placement accepted', turns: 0, usage: null, failed: false };
    },
  };
}

if (process.env['PHYS_LIMIT'] !== undefined) tasks.splice(Number(process.env['PHYS_LIMIT']));
const game = await gameFor('fast', tasks);
const t0 = performance.now();
let done = 0;
const results = await pool(tasks, Number(process.env['CREW_CONCURRENCY'] ?? '4'), async (task) => {
  const policy = placingPolicy(task);
  const shard = game.acquire();
  try {
    const r = await runEpisode({ game: shard.game, levelId: task.id, policy, outDir: join(outDir, 'episodes'), verify: 'none', saveImages: false });
    const item = (r.record.report?.items ?? [])[0] as any;
    const pose = (r.record.load?.items ?? [])[0] as any;
    done += 1;
    if (done % 10 === 0) console.log(`${done}/${tasks.length} in ${((performance.now() - t0) / 1000).toFixed(0)} s`);
    return {
      task: task.id, kind: task.kind, instance: task.instance, soils: (task.level as Level).items[0]?.soils.map((s) => s.type).join('+'), rack: task.rack, condition: task.condition.name,
      placed: policy.placed.accepted, slot: policy.placed.slot, achieved: pose === undefined ? null : stanceOf(task.kind, pose.quat_wxyz),
      washed: r.record.score !== null, clean: item?.clean ?? null, residual_mass_fraction: item?.residual_mass_fraction ?? null, residual_fraction_area: item?.residual_fraction_area ?? null,
      residue_cells: item?.residue_cells ?? null, visible_area_mm2: item?.visible_area_mm2 ?? null, retained_water_ml: item?.retained_water_ml ?? null, holds_water: item?.holds_water ?? null, moved: item?.moved_during_wash ?? null,
      residue_regions: (item?.residue_regions ?? []).join('+'), wash_s: r.record.time?.wash_wall_s ?? null, session: r.record.episode_id,
    };
  } finally {
    game.release(shard);
  }
});
writeFileSync(join(outDir, 'results.json'), `${JSON.stringify(results, null, 1)}\n`);
const cols = Object.keys(results[0] ?? {});
writeFileSync(join(outDir, 'results.csv'), [cols.join(','), ...results.map((r: any) => cols.map((c) => JSON.stringify(r[c] ?? '')).join(','))].join('\n'));
console.log(`${results.length} washes in ${((performance.now() - t0) / 1000).toFixed(0)} s -> ${outDir}`);
await closeGames();
process.exit(0);
