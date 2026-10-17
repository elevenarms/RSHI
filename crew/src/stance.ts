/**
 * How an item stood, in words: derived from its pose (quat_wxyz, tub frame, z up). The item frame
 * of the catalogue has z up when the item is upright (a hollow item's mouth looks along +z) and a
 * handle or long axis along +x. Families: hollow (bowls, glasses, mugs, pots: mouth_up / mouth_down /
 * on_side / tilted_<deg>), flat (plates, boards, trays, lids: on_edge / flat / leaning_<deg>), long
 * (cutlery, utensils: upright / flat / tilted_<deg>).
 */

import { getItemType } from '@spotless/catalogue';

export type KindFamily = 'hollow' | 'flat' | 'long';

const familyCache = new Map<string, KindFamily>();

/** The family of a catalogue kind. */
export function familyOf(kind: string): KindFamily {
  const cached = familyCache.get(kind);
  if (cached !== undefined) return cached;
  let family: KindFamily = 'hollow';
  try {
    const type = getItemType(kind);
    const poses = new Set(type.placement.stablePoses.map((p) => p.name));
    if (type.category === 'cutlery' || poses.has('handle_down')) family = 'long';
    else if (/plate|board|tray|lid_|platter|cooling_rack|sheet|muffin_tin/.test(kind)) family = 'flat';
    else if (poses.has('on_edge') && !poses.has('inverted')) family = 'flat';
    else if (/utensil/.test(type.category) || /turner|spatula|whisk|ladle|tongs|spoon_2|serving_spoon/.test(kind)) family = 'long';
  } catch {
    if (/fork|knife|spoon|turner|spatula|whisk|ladle|tongs/.test(kind)) family = 'long';
    else if (/plate|board|tray|lid|platter/.test(kind)) family = 'flat';
  }
  familyCache.set(kind, family);
  return family;
}

/** The world direction of an item-frame axis under a unit quaternion (w, x, y, z). */
export function rotate(q: readonly number[], v: readonly [number, number, number]): [number, number, number] {
  const [w, x, y, z] = q as [number, number, number, number];
  const [vx, vy, vz] = v;
  // t = 2 * cross(q.xyz, v); v' = v + w t + cross(q.xyz, t)
  const tx = 2 * (y * vz - z * vy);
  const ty = 2 * (z * vx - x * vz);
  const tz = 2 * (x * vy - y * vx);
  return [vx + w * tx + (y * tz - z * ty), vy + w * ty + (z * tx - x * tz), vz + w * tz + (x * ty - y * tx)];
}

const deg = (r: number): number => (r * 180) / Math.PI;
const round15 = (d: number): number => Math.round(d / 15) * 15;

/** The stance of an item of `kind` at orientation `q` (tub frame, z up). */
export function stanceOf(kind: string, q: readonly number[] | null): string | null {
  if (q === null || q.length !== 4) return null;
  const n = Math.hypot(...(q as number[]));
  if (!(n > 0)) return null;
  const qq = q.map((c) => c / n);
  const family = familyOf(kind);
  if (family === 'long') {
    const ax = rotate(qq, [1, 0, 0]);
    const elev = deg(Math.asin(Math.max(-1, Math.min(1, Math.abs(ax[2])))));
    if (elev >= 60) return 'upright';
    if (elev <= 20) return 'flat';
    return `tilted_${round15(elev)}`;
  }
  const up = rotate(qq, [0, 0, 1]);
  const fromUp = deg(Math.acos(Math.max(-1, Math.min(1, up[2])))); // 0 = upright (mouth/face up), 180 = upside down
  if (family === 'flat') {
    const fromVertical = Math.abs(90 - fromUp); // 0 = on edge
    if (fromVertical <= 15) return 'on_edge';
    if (fromVertical >= 70) return fromUp < 90 ? 'flat' : 'flat_inverted';
    return `leaning_${round15(fromVertical)}`;
  }
  if (fromUp >= 160) return 'mouth_down';
  if (fromUp <= 20) return 'mouth_up';
  if (fromUp >= 75 && fromUp <= 105) return 'on_side';
  return fromUp > 90 ? `mouth_down_tilted_${round15(180 - fromUp)}` : `mouth_up_tilted_${round15(fromUp)}`;
}
