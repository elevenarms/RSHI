/**
 * Genomes: the baseline, the deterministic application of the Coach's edits, and diffs.
 */

import { createHash } from 'node:crypto';
import type { Genome, GenomeEdit, PlaybookRule, Proposal } from './contracts.ts';

export const PLANNER_PROMPT = `You are the Planner of a team that loads a real dishwasher (Bosch, simulated physically) in the game Spotless.
You get the level card (items, soils, points) and, sometimes, a brief of lessons from earlier episodes.
Write a short loading plan for the Loader: for every item say rack (lower_rack, upper_rack, cutlery_basket) and stance
(e.g. on_edge between tines, mouth_down, handle_down), and which items to leave out (unlikely to wash clean or no room).
Prefer high-point items. Be concrete and brief (under 250 words).
Answer with a JSON object: {"plan": "<the plan text>", "leave_out": ["item_id", ...]}`;

export const CRITIC_PROMPT = `You are the Critic of a team that loads a simulated dishwasher in the game Spotless.
You get the outcome of one episode item by item (rack, stance, clean or not, residue regions, water retained, moved during wash),
the plan and the playbook. Explain what worked and what failed, grounded in the per-item outcomes,
and distil reusable lessons (one sentence each, imperative, about item kinds / soils / racks / stances; tag them lowercase).
Polarity "support" means the lesson is confirmed by this episode; "contradict" means this episode contradicts it.
Answer with a JSON object: {"worked": [string], "failed": [string], "lessons": [{"text": string, "tags": [string], "polarity": "support"|"contradict"}]}`;

export const BASELINE_PREAMBLE = 'You are the Loader of a team. Play the episode well.';

export interface TeamModels {
  readonly loader: string;
  readonly loaderEffort?: string | null;
}

/** Models that take pictures (the others get none: `images: false`). */
export function isVisionModel(model: string): boolean {
  const m = model.toLowerCase();
  if (m.includes('nemotron')) return m.includes('-vl') || m.includes('omni');
  return !/glm-5\.3$|deepseek-v4-pro|gpt-oss|deepseek-v4-flash/.test(m);
}

function shortHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 6);
}

/** Generation 0: a minimal team. */
export function baselineGenome(models: TeamModels, createdAt = new Date().toISOString()): Genome {
  const body = {
    parentId: null,
    generation: 0,
    rationale: 'baseline',
    team: { usePlanner: false, useMemoryBrief: false, preflightCheck: false, briefLessons: 8 },
    prompts: { planner: PLANNER_PROMPT, loaderPreamble: BASELINE_PREAMBLE, critic: CRITIC_PROMPT },
    playbook: [] as PlaybookRule[],
    loader: {
      model: models.loader,
      reasoningEffort: models.loaderEffort === undefined ? '20' : models.loaderEffort,
      images: isVisionModel(models.loader),
      deniedTools: [] as string[],
      maxTurns: 120,
    },
  };
  return { id: `G0-${shortHash(body)}`, createdAt, ...body };
}

const TEAM_BOOL = new Set(['usePlanner', 'useMemoryBrief', 'preflightCheck']);
const NEVER_DENY = new Set(['place', 'start_cycle', 'get_state', 'remove']);

/** Applies one edit; throws on an invalid one. */
function applyOne(g: { -readonly [K in keyof Genome]: Genome[K] }, edit: GenomeEdit, ruleSeq: () => string): void {
  switch (edit.op) {
    case 'add_rule': {
      const text = String(edit.rule?.text ?? '').trim();
      if (text === '') throw new Error('add_rule: empty text');
      if (g.playbook.length >= 25) throw new Error('add_rule: playbook full (25)');
      const id = edit.rule.id !== undefined && !g.playbook.some((r) => r.id === edit.rule.id) ? edit.rule.id : ruleSeq();
      g.playbook = [...g.playbook, { id, text: text.slice(0, 400), tags: (edit.rule.tags ?? []).map(String), evidence: (edit.rule.evidence ?? []).map(String) }];
      return;
    }
    case 'edit_rule': {
      if (!g.playbook.some((r) => r.id === edit.id)) throw new Error(`edit_rule: no rule ${edit.id}`);
      g.playbook = g.playbook.map((r) => (r.id === edit.id ? { ...r, text: String(edit.text).slice(0, 400), tags: edit.tags ?? r.tags } : r));
      return;
    }
    case 'remove_rule': {
      if (!g.playbook.some((r) => r.id === edit.id)) throw new Error(`remove_rule: no rule ${edit.id}`);
      g.playbook = g.playbook.filter((r) => r.id !== edit.id);
      return;
    }
    case 'set_prompt': {
      if (!['planner', 'loaderPreamble', 'critic'].includes(edit.prompt)) throw new Error(`set_prompt: no prompt ${edit.prompt}`);
      const text = String(edit.text ?? '').trim();
      if (text.length < 10) throw new Error('set_prompt: text too short');
      g.prompts = { ...g.prompts, [edit.prompt]: text.slice(0, 4000) };
      return;
    }
    case 'set_team': {
      if (TEAM_BOOL.has(edit.key)) {
        if (typeof edit.value !== 'boolean') throw new Error(`set_team ${edit.key}: boolean expected`);
      } else if (edit.key === 'briefLessons') {
        if (typeof edit.value !== 'number' || edit.value < 0 || edit.value > 30) throw new Error('set_team briefLessons: 0..30');
      } else throw new Error(`set_team: no key ${String(edit.key)}`);
      g.team = { ...g.team, [edit.key]: edit.value };
      return;
    }
    case 'set_loader': {
      const v = edit.value;
      if (edit.key === 'reasoningEffort') {
        if (v !== null && typeof v !== 'string' && typeof v !== 'number') throw new Error('set_loader reasoningEffort: string/number/null');
        g.loader = { ...g.loader, reasoningEffort: v === null ? null : String(v) };
      } else if (edit.key === 'images') {
        if (typeof v !== 'boolean') throw new Error('set_loader images: boolean');
        g.loader = { ...g.loader, images: v };
      } else if (edit.key === 'deniedTools') {
        if (!Array.isArray(v)) throw new Error('set_loader deniedTools: array');
        const tools = (v as unknown[]).map(String).filter((t) => !NEVER_DENY.has(t));
        g.loader = { ...g.loader, deniedTools: [...new Set(tools)].sort() };
      } else if (edit.key === 'maxTurns') {
        if (typeof v !== 'number' || v < 20 || v > 400) throw new Error('set_loader maxTurns: 20..400');
        g.loader = { ...g.loader, maxTurns: Math.round(v) };
      } else throw new Error(`set_loader: no key ${String(edit.key)}`);
      return;
    }
    default:
      throw new Error(`unknown op ${(edit as { op: string }).op}`);
  }
}

/** The child of `parent` under a proposal; invalid edits are skipped and reported. */
export function applyEdits(parent: Genome, proposal: Proposal, createdAt = new Date().toISOString()): { genome: Genome; applied: GenomeEdit[]; rejected: { edit: GenomeEdit; reason: string }[] } {
  const generation = parent.generation + 1;
  const g = { ...parent, playbook: [...parent.playbook] } as { -readonly [K in keyof Genome]: Genome[K] };
  let n = 0;
  const ruleSeq = (): string => {
    for (;;) {
      n += 1;
      const id = `R${generation}.${n}`;
      if (!g.playbook.some((r) => r.id === id)) return id;
    }
  };
  const applied: GenomeEdit[] = [];
  const rejected: { edit: GenomeEdit; reason: string }[] = [];
  for (const edit of proposal.edits) {
    try {
      applyOne(g, edit, ruleSeq);
      applied.push(edit);
    } catch (error) {
      rejected.push({ edit, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  const body = { parentId: parent.id, generation, rationale: `${proposal.title}: ${proposal.hypothesis}`, team: g.team, prompts: g.prompts, playbook: g.playbook, loader: g.loader };
  return { genome: { id: `G${generation}-${shortHash({ ...body, parentId: parent.id })}`, createdAt, ...body }, applied, rejected };
}

/** What changed from a to b, line by line. */
export function diffGenomes(a: Genome, b: Genome): string[] {
  const out: string[] = [];
  for (const key of Object.keys(a.team) as (keyof Genome['team'])[]) {
    if (a.team[key] !== b.team[key]) out.push(`team.${key}: ${String(a.team[key])} -> ${String(b.team[key])}`);
  }
  for (const key of Object.keys(a.prompts) as (keyof Genome['prompts'])[]) {
    if (a.prompts[key] !== b.prompts[key]) out.push(`prompt ${key} rewritten: "${b.prompts[key].slice(0, 160)}${b.prompts[key].length > 160 ? '...' : ''}"`);
  }
  for (const key of Object.keys(a.loader) as (keyof Genome['loader'])[]) {
    if (JSON.stringify(a.loader[key]) !== JSON.stringify(b.loader[key])) out.push(`loader.${key}: ${JSON.stringify(a.loader[key])} -> ${JSON.stringify(b.loader[key])}`);
  }
  const before = new Map(a.playbook.map((r) => [r.id, r]));
  const after = new Map(b.playbook.map((r) => [r.id, r]));
  for (const r of b.playbook) {
    const old = before.get(r.id);
    if (old === undefined) out.push(`+ rule ${r.id}: ${r.text}`);
    else if (old.text !== r.text) out.push(`~ rule ${r.id}: ${r.text}`);
  }
  for (const r of a.playbook) if (!after.has(r.id)) out.push(`- rule ${r.id}: ${r.text}`);
  return out;
}

/** The loader's extra system text (stable across the episode, for prefix caching). */
export function loaderSystemText(genome: Genome, plan: string | null, brief: string | null): string {
  const parts = [`## Your team's instructions\n\n${genome.prompts.loaderPreamble}`];
  if (genome.playbook.length > 0) parts.push(`## Playbook (rules learned by the team; follow them)\n\n${genome.playbook.map((r) => `- [${r.id}] ${r.text}`).join('\n')}`);
  if (brief !== null && brief.trim() !== '') parts.push(`## Brief from the team's memory\n\n${brief}`);
  if (plan !== null && plan.trim() !== '') parts.push(`## Loading plan from the Planner\n\n${plan}`);
  if (genome.team.preflightCheck) parts.push('## Preflight\n\nstart_cycle is refused until you have called check_load after your last action and fixed what it reports.');
  return parts.join('\n\n');
}
