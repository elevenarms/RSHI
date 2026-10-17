/** What changed from one genome to another (computed in the browser from the two genomes). Pure. */

import type { Genome, PlaybookRule } from '@spotless/crew/contracts';

export type DiffEntry =
  | { readonly kind: 'rule_added'; readonly rule: PlaybookRule }
  | { readonly kind: 'rule_removed'; readonly rule: PlaybookRule }
  | { readonly kind: 'rule_edited'; readonly id: string; readonly before: string; readonly after: string; readonly tagsBefore: readonly string[]; readonly tagsAfter: readonly string[] }
  | { readonly kind: 'prompt'; readonly prompt: keyof Genome['prompts']; readonly before: string; readonly after: string }
  | { readonly kind: 'team'; readonly key: string; readonly before: unknown; readonly after: unknown }
  | { readonly kind: 'loader'; readonly key: string; readonly before: unknown; readonly after: unknown };

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export function diffGenomes(parent: Genome | null, child: Genome): readonly DiffEntry[] {
  const out: DiffEntry[] = [];
  const before = new Map((parent?.playbook ?? []).map((r) => [r.id, r]));
  const after = new Map(child.playbook.map((r) => [r.id, r]));
  for (const r of child.playbook) {
    const old = before.get(r.id);
    if (!old) out.push({ kind: 'rule_added', rule: r });
    else if (old.text !== r.text || !same(old.tags, r.tags))
      out.push({ kind: 'rule_edited', id: r.id, before: old.text, after: r.text, tagsBefore: old.tags, tagsAfter: r.tags });
  }
  for (const r of parent?.playbook ?? []) if (!after.has(r.id)) out.push({ kind: 'rule_removed', rule: r });
  if (!parent) return out;
  for (const k of Object.keys(child.prompts) as (keyof Genome['prompts'])[]) {
    if (parent.prompts[k] !== child.prompts[k]) out.push({ kind: 'prompt', prompt: k, before: parent.prompts[k] ?? '', after: child.prompts[k] });
  }
  for (const [k, v] of Object.entries(child.team)) {
    const b = (parent.team as Record<string, unknown>)[k];
    if (!same(b, v)) out.push({ kind: 'team', key: k, before: b, after: v });
  }
  for (const [k, v] of Object.entries(child.loader)) {
    const b = (parent.loader as Record<string, unknown>)[k];
    if (!same(b, v)) out.push({ kind: 'loader', key: k, before: b, after: v });
  }
  return out;
}

export type WordOp = { readonly op: 'same' | 'add' | 'del'; readonly text: string };

/** A word-level diff (LCS over whitespace-separated tokens), for prompts and edited rules. */
export function wordDiff(a: string, b: string): readonly WordOp[] {
  const x = a.split(/(\s+)/).filter((t) => t.length > 0);
  const y = b.split(/(\s+)/).filter((t) => t.length > 0);
  // Keep it bounded: very long prompts fall back to a whole replacement.
  if (x.length * y.length > 400_000) return [{ op: 'del', text: a }, { op: 'add', text: b }];
  const n = x.length;
  const m = y.length;
  const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    const row = dp[i]!;
    const below = dp[i + 1]!;
    for (let j = m - 1; j >= 0; j--) row[j] = x[i] === y[j] ? below[j + 1]! + 1 : Math.max(below[j]!, row[j + 1]!);
  }
  const ops: WordOp[] = [];
  const push = (op: WordOp['op'], text: string): void => {
    const last = ops[ops.length - 1];
    if (last && last.op === op) ops[ops.length - 1] = { op, text: last.text + text };
    else ops.push({ op, text });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) {
      push('same', x[i]!);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) push('del', x[i++]!);
    else push('add', y[j++]!);
  }
  while (i < n) push('del', x[i++]!);
  while (j < m) push('add', y[j++]!);
  return ops;
}
