/**
 * The task suite: "drills", small levels drawn from the items of course levels. Train drills
 * come from tutorial, lunch-for-four, weeknight-dinner and breakfast; test drills (held out,
 * the exam) from mixed-family, baking-day and dinner-party, which have kinds and soils the
 * train levels lack: the exam measures transfer to unseen tasks.
 */

import { getItemType } from '@spotless/catalogue';
import type { Level, LevelItem } from '@spotless/levels';
import { findLevel, starterRules, validateLevel } from '@spotless/levels';
import type { Split, TaskSpec } from './contracts.ts';

export const TRAIN_SOURCES = ['tutorial', 'lunch-for-four', 'weeknight-dinner', 'breakfast'] as const;
export const TEST_SOURCES = ['mixed-family', 'baking-day', 'dinner-party'] as const;

export const DEFAULT_DRILL_ITEMS = Number(process.env['CREW_DRILL_ITEMS'] ?? '10');

/** mulberry32: a small seeded generator. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

function isCutlery(item: LevelItem): boolean {
  try {
    return getItemType(item.itemType).category === 'cutlery';
  } catch {
    return false;
  }
}

const TITLES: { [id: string]: string } = {
  tutorial: 'Tutorial',
  'lunch-for-four': 'Lunch',
  'weeknight-dinner': 'Weeknight',
  breakfast: 'Breakfast',
  'mixed-family': 'Family',
  'baking-day': 'Baking',
  'dinner-party': 'Dinner party',
};

/** A drill of `n` items of a source level, chosen by `seed` (cutlery in the source's proportion). */
export function drill(sourceId: string, n: number, seed: number, split: Split): TaskSpec {
  const source = findLevel(sourceId);
  if (source === undefined) throw new Error(`no level ${sourceId}`);
  const count = Math.min(n, source.items.length);
  const random = rng(seed * 7919 + sourceId.length * 104729);
  const cutlery = source.items.filter(isCutlery);
  const rest = source.items.filter((i) => !isCutlery(i));
  const nCut = Math.min(cutlery.length, Math.round((count * cutlery.length) / source.items.length));
  const chosen = [...shuffled(cutlery, random).slice(0, nCut), ...shuffled(rest, random).slice(0, count - nCut)];
  const order = new Map(source.items.map((item, i) => [item.id, i]));
  chosen.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const id = `drill-${sourceId}-${count}-s${seed}`;
  const level: Level = {
    id,
    title: `${TITLES[sourceId] ?? sourceId} drill #${seed}`,
    summary: `${count} pieces from "${source.title}". Load what will come out clean and start the cycle.`,
    machineId: source.machineId,
    config: source.config,
    racks: source.racks,
    programmeId: source.programmeId,
    items: chosen,
    rules: starterRules(count),
    seed: source.seed,
    manual: source.manual,
  };
  const problems = validateLevel(level);
  if (problems.length > 0) throw new Error(`drill ${id} is not valid: ${problems[0]?.path} ${problems[0]?.message}`);
  return {
    id,
    split,
    title: level.title,
    sourceLevelId: sourceId,
    itemCount: count,
    pointsAvailable: chosen.reduce((s, i) => s + i.points, 0),
    level,
  };
}

function suite(sources: readonly string[], split: Split, count: number, seedBase: number, n: number): TaskSpec[] {
  const out: TaskSpec[] = [];
  for (let k = 0; k < count; k++) {
    const source = sources[(k + seedBase) % sources.length] as string;
    out.push(drill(source, n, seedBase + k, split));
  }
  return out;
}

/** Train drills (the team may learn from them), rotating over the train sources. */
export function trainTasks(count: number, seedBase: number, n = DEFAULT_DRILL_ITEMS): TaskSpec[] {
  return suite(TRAIN_SOURCES, 'train', count, seedBase, n);
}

/** Test drills (held out): never played before the exam, never learned from. */
export function testTasks(count: number, seedBase: number, n = DEFAULT_DRILL_ITEMS): TaskSpec[] {
  return suite(TEST_SOURCES, 'test', count, seedBase, n);
}

/** Kinds and soils of a task, for the Librarian's brief. */
export function taskCard(task: TaskSpec): { kinds: string[]; soils: string[] } {
  const level = task.level as Level;
  return {
    kinds: [...new Set(level.items.map((i) => i.itemType))],
    soils: [...new Set(level.items.flatMap((i) => i.soils.map((s) => s.type)))],
  };
}
