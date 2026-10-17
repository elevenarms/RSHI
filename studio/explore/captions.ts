/**
 * EVERY WORD THE AUDIENCE READS lives here. Edit freely: the page hot-reloads.
 *
 * A caption is a template string; `{field}` is replaced by the value of that field of the
 * moment (listed above each entry). A list of strings rotates: each time the caption is used,
 * the next one is picked, so repeated moments do not repeat their jokes.
 *
 * `kicker` is the small label above the caption (who is speaking / what is going on).
 */

export type Template = string | readonly string[];

export interface Caption {
  readonly kicker: Template;
  readonly text: Template;
}

export const CAPTIONS = {
  /** fields: task, gen, items, points */
  episodeStart: {
    kicker: 'Loader · generation {gen}',
    text: ['Generation {gen} steps up to "{task}": {items} dirty items, {points} points on the line', 'New drill: "{task}". {items} items. Zero excuses.'],
  },
  /** fields: (none) */
  plan: { kicker: 'Planner', text: 'The Planner sketches a plan before a single plate moves' },
  /** fields: n */
  brief: { kicker: 'Librarian', text: 'The Librarian slides over {n} lessons from past disasters' },
  /** fields: item, rack, stance */
  place: { kicker: 'Loader', text: ['{item} goes in the {rack}, {stance}', '{item} → {rack}, {stance}. Bold.'] },
  /** fields: item, why */
  refused: { kicker: 'Loader · refused', text: 'The game says no: {item} {why}' },
  /** fields: (none) */
  preflight: { kicker: 'Loader', text: 'Preflight check: spray arms spin, door closes. Cleared for washing' },
  /** fields: (none) */
  washStarted: { kicker: 'Wash · Eco 50', text: ['Door closed. Eco 50. Nobody breathe.', 'The physics engine is now judging every crumb'] },
  /** fields: points, available, clean, items */
  episodeDone: { kicker: 'Result', text: '{points} of {available} points: {clean} of {items} items came out spotless' },
  /** fields: lesson */
  critique: { kicker: 'Critic · post-mortem', text: ['The Critic noticed: {lesson}', 'Post-mortem says: {lesson}'] },
  /** fields: lessons, episodes */
  memory: { kicker: 'Librarian · memory', text: 'Filed under "never again". {lessons} lessons from {episodes} episodes' },
  /** fields: title */
  proposal: { kicker: 'Coach · proposal', text: ['The Coach proposes: {title}', 'Coach, scribbling on the whiteboard: "{title}"'] },
  /** fields: drills */
  evaluate: { kicker: 'Gatekeeper', text: 'Old team vs new team, same {drills} drills, no peeking' },
  /** fields: delta, drills, title */
  accepted: { kicker: 'Gatekeeper · verdict', text: 'Gatekeeper: {delta} on the same {drills} drills → kept' },
  /** fields: delta, drills, title */
  rejected: { kicker: 'Gatekeeper · verdict', text: ['Gatekeeper: {delta} on the same {drills} drills → binned', 'Nice idea. The numbers disagree ({delta}). Rejected.'] },
  /** fields: tasks */
  exam: { kicker: 'Final exam', text: '{tasks} levels it has never seen. Day-one team vs today\'s team' },
  /** fields: delta, before, after */
  examResult: { kicker: 'Final exam · unseen levels', text: '{before} → {after}. The team got better at a thing nobody taught it' },
} satisfies Record<string, Caption>;

/** The intro title card (key T) and the outro card (key O). */
export const CARDS = {
  title: {
    name: 'CREW',
    subtitle: 'a team that gets better at loading the dishwasher',
    credit: 'on Crusoe Managed Inference',
  },
  outro: {
    /** fields: delta, before, after, tasks */
    headline: '{delta} on unseen levels',
    sub: 'from {before} to {after} across {tasks} held-out exams',
    credit: 'CREW · six agents, one dishwasher · on Crusoe Managed Inference',
  },
  /** The big verdict stamp. */
  stamp: { accepted: 'ACCEPTED', rejected: 'REJECTED' },
  /** The exam finale's big line. fields: delta */
  examBig: '{delta} on unseen levels',
} as const;

// ---------------------------------------------------------------------------------------------

const turns = new Map<string, number>();

/** Picks the next string of a template (rotating lists) and fills its `{fields}`. */
export function fill(t: Template, fields: Record<string, unknown> = {}, key = ''): string {
  let s: string;
  if (typeof t === 'string') s = t;
  else {
    const n = turns.get(key) ?? 0;
    turns.set(key, n + 1);
    s = t[n % t.length] ?? '';
  }
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (fields[k] === undefined ? `{${k}}` : String(fields[k])));
}

export function caption(key: keyof typeof CAPTIONS, fields: Record<string, unknown> = {}): { kicker: string; text: string } {
  const c: Caption = CAPTIONS[key];
  return { kicker: fill(c.kicker, fields, key + ':k'), text: fill(c.text, fields, key) };
}
