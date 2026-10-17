/**
 * Pretend data and a scripted, looping "run" for the design sandbox. Nothing here talks to the
 * crew: the timeline mutates a `World` on a clock, and the variants draw the world.
 *
 * The shapes mirror the studio's state (src/state.ts) loosely, so a chosen design folds back in.
 */

import { caption } from './captions';

export type Role = 'planner' | 'loader' | 'critic' | 'coach' | 'gatekeeper' | 'librarian';
export const ROLES: readonly Role[] = ['planner', 'loader', 'critic', 'coach', 'gatekeeper', 'librarian'];

export const ROLE_INFO: Record<Role, { name: string; job: string; model: string; glyph: string }> = {
  planner: { name: 'Planner', job: 'writes the loading plan', model: 'Llama 3.3 70B', glyph: 'P' },
  loader: { name: 'Loader', job: 'plays the game', model: 'Qwen3 235B', glyph: 'L' },
  critic: { name: 'Critic', job: 'post-mortems each wash', model: 'DeepSeek R1', glyph: 'C' },
  coach: { name: 'Coach', job: 'rewrites the team', model: 'Kimi K2', glyph: 'K' },
  gatekeeper: { name: 'Gatekeeper', job: 'keeps only what wins', model: 'paired eval', glyph: 'G' },
  librarian: { name: 'Librarian', job: 'remembers everything', model: 'memory', glyph: 'M' },
};

export type Status = 'idle' | 'thinking' | 'acting' | 'done';
export type MsgKind = 'plan' | 'brief' | 'lesson' | 'critique' | 'proposal' | 'verdict' | 'note';

export interface Msg { id: number; from: Role; to: Role | 'all'; kind: MsgKind; title: string; body: string }
export interface Tool { id: number; seq: number; name: string; args: string; ok: boolean; summary: string; thought?: string }
export interface EvoPoint { gen: number; title: string; champion: number; candidate: number | null; accepted: boolean | null; delta: number }
export interface Lesson { id: string; text: string; tags: string[]; confidence: number; support: number; source: 'critic' | 'observed' | 'coach'; fresh?: boolean }
export interface Heat { cols: string[]; rows: string[]; cells: (number | null)[][]; n: number[][] }
export interface ExamTask { id: string; title: string; before: number; after: number }
export interface Proposal { title: string; hypothesis: string; edits: { op: string; text: string }[] }
export interface Verdict { accepted: boolean; delta: number; before: number; after: number; title: string; perTask: { task: string; before: number; after: number }[] }

export type Moment =
  | { kind: 'idle' }
  | { kind: 'episode' }
  | { kind: 'critique'; lesson: string; worked: string[]; failed: string[] }
  | { kind: 'memory' }
  | { kind: 'proposal'; proposal: Proposal }
  | { kind: 'evaluate'; proposal: Proposal }
  | { kind: 'verdict'; verdict: Verdict }
  | { kind: 'exam' };

export type Phase = 'baseline' | 'practice' | 'review' | 'propose' | 'evaluate' | 'exam' | 'done';
export const PHASES: readonly Phase[] = ['baseline', 'practice', 'review', 'propose', 'evaluate', 'exam', 'done'];

export interface Episode {
  task: string;
  taskId: string;
  gen: number;
  items: number;
  available: number;
  points: number;
  placed: number;
  clean: number | null;
  scene: number; // 1..6, assets/scene-N.jpg
  wash: 'none' | 'running' | 'done';
  progress: number; // 0..1
}

export interface World {
  /** Bumped on every change; parts have their own counters so views redraw only what changed. */
  rev: { [K in 'agents' | 'msgs' | 'tools' | 'evo' | 'mem' | 'episode' | 'moment' | 'caption' | 'phase' | 'exam' | 'eval']: number };
  phase: Phase;
  generation: number;
  agents: Record<Role, { status: Status; label: string }>;
  msgs: Msg[];
  /** A message in flight (for the traveling-dot animations): set when sent. */
  lastMsg: Msg | null;
  tools: Tool[];
  episode: Episode;
  evo: EvoPoint[];
  lessons: Lesson[];
  heat: Heat;
  stats: { episodes: number; lessons: number; genomes: number; tokensIn: number; tokensOut: number; toolCalls: number };
  moment: Moment;
  caption: { kicker: string; text: string; role: Role | null };
  /** Paired evaluation in progress: per drill, incumbent and candidate scores filled so far. */
  evalRun: { title: string; drills: { task: string; before: number; after: number; done: number }[] } | null;
  exam: { tasks: ExamTask[]; before: number; after: number; revealed: number } | null;
  /** Elapsed seconds into the loop. */
  t: number;
  loopLength: number;
}

const TRAIN = [
  { id: 'drill-01', title: 'Porridge bowls & a stubborn pot' },
  { id: 'drill-04', title: 'Wine glasses, gently' },
  { id: 'drill-07', title: 'Lasagne night' },
];

const EXAM: ExamTask[] = [
  { id: 'exam-A', title: 'Sunday roast aftermath', before: 41, after: 63 },
  { id: 'exam-B', title: "Kids' birthday party", before: 52, after: 70 },
  { id: 'exam-C', title: 'Curry for six', before: 45, after: 65 },
];

function baseEvo(): EvoPoint[] {
  return [
    { gen: 0, title: 'baseline', champion: 48.0, candidate: null, accepted: null, delta: 0 },
    { gen: 1, title: 'Plan before loading', champion: 55.2, candidate: 55.2, accepted: true, delta: 7.2 },
    { gen: 1, title: 'Images off to save tokens', champion: 55.2, candidate: 51.0, accepted: false, delta: -4.2 },
    { gen: 2, title: 'Bowls mouth-down, always', champion: 61.8, candidate: 61.8, accepted: true, delta: 6.6 },
    { gen: 2, title: 'At most 3 render calls', champion: 61.8, candidate: 60.1, accepted: false, delta: -1.7 },
  ];
}

function baseLessons(): Lesson[] {
  return [
    { id: 'L-03', text: 'Bowls left mouth-up hold water, and water means a failed item.', tags: ['bowl', 'mouth_up'], confidence: 0.93, support: 14, source: 'critic' },
    { id: 'L-01', text: 'Plates go in the lower rack, facing the centre spray arm.', tags: ['dinner_plate', 'lower_rack'], confidence: 0.88, support: 11, source: 'observed' },
    { id: 'L-07', text: 'Tall glasses in the lower rack block the upper spray arm.', tags: ['glass', 'spray_arm'], confidence: 0.81, support: 7, source: 'critic' },
    { id: 'L-09', text: 'Run check_load before start_cycle. It is free insurance.', tags: ['general'], confidence: 0.77, support: 6, source: 'coach' },
    { id: 'L-05', text: 'Dried porridge needs the lower rack’s stronger jets.', tags: ['bowl', 'porridge'], confidence: 0.66, support: 5, source: 'observed' },
    { id: 'L-11', text: 'Knives point down in the cutlery basket. Also: fingers.', tags: ['knife', 'cutlery_basket'], confidence: 0.61, support: 4, source: 'critic' },
  ];
}

const NEW_LESSON: Lesson = {
  id: 'L-14',
  text: 'A mug on its side still pools water in the handle corner. Mouth down only.',
  tags: ['mug', 'on_side'],
  confidence: 0.58,
  support: 2,
  source: 'critic',
  fresh: true,
};

function baseHeat(): Heat {
  const rows = ['plate', 'bowl', 'mug', 'glass', 'pot', 'cutlery'];
  const cols = ['lower · upright', 'lower · mouth down', 'upper · mouth down', 'upper · on side', 'upper · mouth up', 'basket'];
  const cells: (number | null)[][] = [
    [0.94, null, null, null, null, null],
    [0.31, 0.82, 0.9, 0.44, 0.08, null],
    [null, 0.7, 0.92, 0.38, 0.05, null],
    [0.42, 0.6, 0.87, 0.51, 0.12, null],
    [null, 0.74, null, null, null, null],
    [null, null, null, null, null, 0.83],
  ];
  const n = cells.map((r, i) => r.map((c, j) => (c === null ? 0 : 3 + ((i * 7 + j * 5) % 19))));
  return { rows, cols, cells, n };
}

export function initialWorld(): World {
  const zero = { agents: 0, msgs: 0, tools: 0, evo: 0, mem: 0, episode: 0, moment: 0, caption: 0, phase: 0, exam: 0, eval: 0 };
  const agents = {} as World['agents'];
  for (const r of ROLES) agents[r] = { status: 'idle', label: '' };
  return {
    rev: zero,
    phase: 'practice',
    generation: 3,
    agents,
    msgs: seedMsgs(),
    lastMsg: null,
    tools: [],
    episode: { task: TRAIN[0]!.title, taskId: TRAIN[0]!.id, gen: 3, items: 12, available: 64, points: 0, placed: 0, clean: null, scene: 1, wash: 'none', progress: 0 },
    evo: baseEvo(),
    lessons: baseLessons(),
    heat: baseHeat(),
    stats: { episodes: 41, lessons: 6, genomes: 5, tokensIn: 3_412_000, tokensOut: 288_400, toolCalls: 1_906 },
    moment: { kind: 'idle' },
    caption: { kicker: 'CREW', text: 'Six agents, one dishwasher, and a lot of feedback', role: null },
    evalRun: null,
    exam: null,
    t: 0,
    loopLength: TIMELINE_LENGTH,
  };
}

let msgId = 1000;
function seedMsgs(): Msg[] {
  const m = (from: Role, to: Role | 'all', kind: MsgKind, title: string, body: string): Msg => ({ id: msgId++, from, to, kind, title, body });
  return [
    m('gatekeeper', 'all', 'verdict', 'Rejected: At most 3 render calls', '60.1% vs 61.8% on the same 3 drills (−1.7). Fewer pictures, more broken glasses.'),
    m('coach', 'gatekeeper', 'proposal', 'At most 3 render calls', 'Hypothesis: the loader wastes turns looking. Cap render() at 3 per episode.'),
    m('librarian', 'all', 'lesson', '6 lessons, 41 episodes', 'Top: bowls mouth-down (0.93), plates face the centre arm (0.88).'),
    m('gatekeeper', 'all', 'verdict', 'Accepted: Bowls mouth-down, always', '61.8% vs 55.2% on the same 3 drills (+6.6).'),
  ];
}

// ---------------------------------------------------------------------------------------------
// The timeline
// ---------------------------------------------------------------------------------------------

type Beat = { at: number; name?: string; run: (w: World) => void };

function bump(w: World, ...parts: (keyof World['rev'])[]): void {
  for (const p of parts) w.rev[p]++;
}

function say(w: World, key: Parameters<typeof caption>[0], fields: Record<string, unknown>, role: Role | null): void {
  w.caption = { ...caption(key, fields), role };
  bump(w, 'caption');
}

function status(w: World, role: Role, s: Status, label = ''): void {
  w.agents[role] = { status: s, label };
  bump(w, 'agents');
}

function send(w: World, from: Role, to: Role | 'all', kind: MsgKind, title: string, body: string): void {
  const m: Msg = { id: msgId++, from, to, kind, title, body };
  w.msgs = [m, ...w.msgs].slice(0, 40);
  w.lastMsg = m;
  bump(w, 'msgs');
}

let toolId = 1;
function tool(w: World, name: string, args: string, ok: boolean, summary: string, thought?: string): void {
  const t: Tool = { id: toolId++, seq: w.tools.length + 1, name, args, ok, summary, thought };
  w.tools = [t, ...w.tools].slice(0, 60);
  w.stats.toolCalls++;
  w.stats.tokensIn += 9_000 + ((toolId * 7919) % 6000);
  w.stats.tokensOut += 300 + ((toolId * 104729) % 900);
  bump(w, 'tools');
}

function moment(w: World, m: Moment): void {
  w.moment = m;
  bump(w, 'moment');
}

function phase(w: World, p: Phase): void {
  w.phase = p;
  bump(w, 'phase');
}

const PLACES: { item: string; rack: string; stance: string; pts: number; thought: string; refused?: string }[] = [
  { item: 'bowl_01', rack: 'upper rack', stance: 'mouth down', pts: 8, thought: 'Porridge bowl. Lesson L-03: mouth down, or it becomes a soup bowl.' },
  { item: 'plate_01', rack: 'lower rack', stance: 'upright', pts: 10, thought: 'Plates face the centre arm (L-01). Slot R1-4.' },
  { item: 'plate_02', rack: 'lower rack', stance: 'upright', pts: 10, thought: 'Next slot over. Keeping a gap for the jets.' },
  { item: 'glass_02', rack: 'lower rack', stance: 'mouth down', pts: 0, thought: 'Glass in the lower rack, then.', refused: 'collides with the rim of plate_02' },
  { item: 'glass_02', rack: 'upper rack', stance: 'mouth down', pts: 6, thought: 'Refused. Fine: glasses belong upstairs anyway (L-07).' },
  { item: 'mug_01', rack: 'upper rack', stance: 'mouth down', pts: 6, thought: 'Tomato soup mug, mouth down on the cup shelf.' },
  { item: 'pot_01', rack: 'lower rack', stance: 'mouth down', pts: 12, thought: 'The stubborn pot gets the strongest jets, back left corner.' },
  { item: 'knife_01', rack: 'cutlery basket', stance: 'blade down', pts: 2, thought: 'Knife blade down. For the fingers.' },
  { item: 'spoon_01', rack: 'cutlery basket', stance: 'handle down', pts: 2, thought: 'Spoons handle down so the bowl of the spoon faces the spray.' },
];

const PROPOSAL_A: Proposal = {
  title: 'Enforce a preflight check',
  hypothesis: 'Two of the last five washes started with a spray arm blocked. Make check_load mandatory before start_cycle.',
  edits: [
    { op: 'set_team', text: 'preflightCheck: false → true' },
    { op: 'add_rule', text: '+ "Read check_load. If an arm is stopped, fix it before you wash."' },
    { op: 'edit_rule', text: '~ L-09 "free insurance" → "required"' },
  ],
};

const PROPOSAL_B: Proposal = {
  title: 'Hide the render tool to save queries',
  hypothesis: 'The loader looks at 9 pictures per episode. Without them it might just… load faster?',
  edits: [
    { op: 'set_loader', text: 'deniedTools: [] → ["render"]' },
    { op: 'set_loader', text: 'images: true → false' },
  ],
};

const VERDICT_A: Verdict = {
  accepted: true,
  delta: 6.1,
  before: 61.8,
  after: 67.9,
  title: PROPOSAL_A.title,
  perTask: [
    { task: TRAIN[0]!.title, before: 58, after: 66 },
    { task: TRAIN[1]!.title, before: 64, after: 69 },
    { task: TRAIN[2]!.title, before: 63, after: 68.7 },
  ],
};

const VERDICT_B: Verdict = {
  accepted: false,
  delta: -9.4,
  before: 67.9,
  after: 58.5,
  title: PROPOSAL_B.title,
  perTask: [
    { task: TRAIN[0]!.title, before: 66, after: 61 },
    { task: TRAIN[1]!.title, before: 69, after: 49 },
    { task: TRAIN[2]!.title, before: 68.7, after: 65.5 },
  ],
};

function beats(): Beat[] {
  const b: Beat[] = [];
  b.push({
    at: 0,
    name: 'episode',
    run: (w) => {
      phase(w, 'practice');
      w.tools = [];
      w.episode = { ...w.episode, points: 0, placed: 0, clean: null, scene: 1, wash: 'none', progress: 0 };
      bump(w, 'episode', 'tools');
      moment(w, { kind: 'episode' });
      status(w, 'planner', 'thinking', 'reading the level card');
      say(w, 'episodeStart', { task: w.episode.task, gen: w.generation, items: w.episode.items, points: w.episode.available }, 'loader');
    },
  });
  b.push({
    at: 2.2,
    run: (w) => {
      status(w, 'planner', 'done', 'plan written');
      send(w, 'planner', 'loader', 'plan', 'Plan for drill-01', 'Pot back-left lower. Bowls + mugs upper, mouth down. Glasses upper only. Cutlery last.');
      status(w, 'librarian', 'acting', 'briefing');
    },
  });
  b.push({
    at: 3.4,
    run: (w) => {
      send(w, 'librarian', 'loader', 'brief', 'Brief: 5 lessons', 'L-03 bowls mouth-down (0.93) · L-01 plates face centre (0.88) · L-07 glasses upstairs (0.81) …');
      status(w, 'librarian', 'idle');
      status(w, 'loader', 'acting', 'loading');
      tool(w, 'get_level_card', '{}', true, '12 items · 64 pts · Eco 50', 'Twelve items. One pot that has seen things.');
    },
  });
  let t = 4.6;
  PLACES.forEach((p, i) => {
    b.push({
      at: t,
      run: (w) => {
        tool(w, 'pick_up', `{"item":"${p.item}"}`, true, `holding ${p.item}`, p.thought);
        if (i === 0) say(w, 'place', { item: p.item, rack: p.rack, stance: p.stance }, 'loader');
      },
    });
    b.push({
      at: t + 0.7,
      run: (w) => {
        if (p.refused) {
          tool(w, 'place', `{"rack":"${p.rack}","stance":"${p.stance.replace(' ', '_')}"}`, false, `refused: ${p.refused}`);
          say(w, 'refused', { item: p.item, why: p.refused }, 'loader');
        } else {
          tool(w, 'place', `{"rack":"${p.rack}","stance":"${p.stance.replace(' ', '_')}"}`, true, `${p.item} settled · ${p.rack} · ${p.stance}`);
          w.episode.placed++;
          w.episode.progress = w.episode.placed / 8;
          if (w.episode.placed === 3) w.episode.scene = 2;
          if (w.episode.placed === 6) w.episode.scene = 3;
          bump(w, 'episode');
        }
      },
    });
    if (i === 4) b.push({ at: t + 1.1, run: (w) => tool(w, 'render', '{"view":"top_upper"}', true, 'image 1024×768 · 1 query', 'Checking the upper rack from above.') });
    t += 1.5;
  });
  b.push({
    at: t,
    run: (w) => {
      tool(w, 'check_load', '{}', true, 'arms turn freely · door closes · nothing shifted', 'Preflight is clean. Washing.');
      say(w, 'preflight', {}, 'loader');
    },
  });
  t += 1.6;
  b.push({
    at: t,
    name: 'wash',
    run: (w) => {
      tool(w, 'start_cycle', '{"programme":"eco_50"}', true, 'washing · simulating every surface');
      w.episode.wash = 'running';
      w.episode.scene = 4;
      bump(w, 'episode');
      status(w, 'loader', 'done', 'washing');
      say(w, 'washStarted', {}, null);
    },
  });
  t += 4.5;
  b.push({
    at: t,
    run: (w) => {
      w.episode.wash = 'done';
      w.episode.points = 52;
      w.episode.clean = 10;
      w.episode.scene = 5;
      w.stats.episodes++;
      bump(w, 'episode');
      say(w, 'episodeDone', { points: 52, available: 64, clean: 10, items: 12 }, null);
    },
  });
  t += 3;
  b.push({
    at: t,
    name: 'critique',
    run: (w) => {
      phase(w, 'review');
      status(w, 'critic', 'thinking', 'post-mortem of drill-01');
    },
  });
  t += 1.8;
  b.push({
    at: t,
    run: (w) => {
      status(w, 'critic', 'done', 'critique sent');
      send(w, 'critic', 'librarian', 'critique', 'Post-mortem: drill-01 · 52/64', NEW_LESSON.text);
      moment(w, {
        kind: 'critique',
        lesson: NEW_LESSON.text,
        worked: ['Pot in the back-left corner came out spotless', 'Glass moved upstairs after a refusal'],
        failed: ['mug_02 on its side kept 30 ml of water', 'spoon_02 nested in spoon_01'],
      });
      say(w, 'critique', { lesson: 'mugs on their side keep a puddle in the handle corner' }, 'critic');
    },
  });
  t += 5.5;
  b.push({
    at: t,
    name: 'memory',
    run: (w) => {
      status(w, 'librarian', 'acting', 'merging lessons');
      w.lessons = [NEW_LESSON, ...w.lessons.map((l) => (l.id === 'L-09' ? { ...l, confidence: 0.84, support: 8 } : { ...l, fresh: false }))];
      w.stats.lessons = w.lessons.length;
      const h = w.heat;
      h.cells[2]![3] = 0.31;
      h.n[2]![3]! += 2;
      bump(w, 'mem');
      send(w, 'librarian', 'all', 'lesson', 'New lesson L-14 · 0.58', NEW_LESSON.text);
      moment(w, { kind: 'memory' });
      say(w, 'memory', { lessons: w.lessons.length, episodes: w.stats.episodes }, 'librarian');
    },
  });
  t += 5;
  b.push({
    at: t,
    name: 'proposal',
    run: (w) => {
      status(w, 'librarian', 'idle');
      phase(w, 'propose');
      status(w, 'coach', 'thinking', 'reading 42 episodes');
    },
  });
  t += 1.6;
  b.push({
    at: t,
    run: (w) => {
      status(w, 'coach', 'done', 'proposal sent');
      send(w, 'coach', 'gatekeeper', 'proposal', PROPOSAL_A.title, PROPOSAL_A.hypothesis);
      w.stats.genomes++;
      moment(w, { kind: 'proposal', proposal: PROPOSAL_A });
      say(w, 'proposal', { title: 'make the preflight check mandatory' }, 'coach');
    },
  });
  t += 5.5;
  t = evaluation(b, t, PROPOSAL_A, VERDICT_A);
  t += 1;
  b.push({
    at: t,
    name: 'proposal2',
    run: (w) => {
      phase(w, 'propose');
      status(w, 'coach', 'done', 'proposal sent');
      send(w, 'coach', 'gatekeeper', 'proposal', PROPOSAL_B.title, PROPOSAL_B.hypothesis);
      w.stats.genomes++;
      moment(w, { kind: 'proposal', proposal: PROPOSAL_B });
      say(w, 'proposal', { title: 'stop looking at the dishes to save time' }, 'coach');
    },
  });
  t += 4.5;
  t = evaluation(b, t, PROPOSAL_B, VERDICT_B);
  t += 1;
  b.push({
    at: t,
    name: 'exam',
    run: (w) => {
      phase(w, 'exam');
      for (const r of ROLES) status(w, r, r === 'loader' ? 'acting' : 'idle', r === 'loader' ? 'exam' : '');
      w.exam = { tasks: EXAM, before: 46, after: 66, revealed: 0 };
      bump(w, 'exam');
      moment(w, { kind: 'exam' });
      say(w, 'exam', { tasks: EXAM.length }, null);
    },
  });
  for (let i = 1; i <= EXAM.length; i++) {
    b.push({
      at: t + 1.5 + i * 1.6,
      run: (w) => {
        if (w.exam) w.exam.revealed = i;
        bump(w, 'exam');
      },
    });
  }
  t += 1.5 + EXAM.length * 1.6 + 1.6;
  b.push({
    at: t,
    name: 'examResult',
    run: (w) => {
      if (w.exam) w.exam.revealed = EXAM.length + 1;
      bump(w, 'exam');
      status(w, 'loader', 'done');
      say(w, 'examResult', { before: '46%', after: '66%', delta: '+20' }, null);
    },
  });
  t += 9;
  b.push({ at: t, name: 'end', run: () => undefined });
  return b;
}

function evaluation(b: Beat[], t0: number, p: Proposal, v: Verdict): number {
  let t = t0;
  b.push({
    at: t,
    run: (w) => {
      phase(w, 'evaluate');
      status(w, 'gatekeeper', 'acting', 'paired evaluation');
      status(w, 'loader', 'acting', 'eval drills');
      w.evalRun = { title: p.title, drills: v.perTask.map((d) => ({ ...d, done: 0 })) };
      bump(w, 'eval');
      moment(w, { kind: 'evaluate', proposal: p });
      say(w, 'evaluate', { drills: v.perTask.length }, 'gatekeeper');
    },
  });
  v.perTask.forEach((_, i) => {
    b.push({
      at: t + 0.8 + i * 0.9,
      run: (w) => {
        if (w.evalRun?.drills[i]) w.evalRun.drills[i]!.done = 1;
        w.stats.episodes += 2;
        bump(w, 'eval');
      },
    });
  });
  t += 0.8 + v.perTask.length * 0.9 + 0.6;
  b.push({
    at: t,
    name: v.accepted ? 'verdict' : 'verdict2',
    run: (w) => {
      status(w, 'gatekeeper', 'done', v.accepted ? 'kept' : 'binned');
      status(w, 'loader', 'idle');
      const champ = w.evo[w.evo.length - 1]!.champion;
      w.evo = [...w.evo, { gen: w.generation, title: v.title, champion: v.accepted ? v.after : champ, candidate: v.after, accepted: v.accepted, delta: v.delta }];
      bump(w, 'evo');
      const sign = v.delta > 0 ? '+' : '−';
      send(w, 'gatekeeper', 'all', 'verdict', `${v.accepted ? 'Accepted' : 'Rejected'}: ${v.title}`, `${v.after.toFixed(1)}% vs ${v.before.toFixed(1)}% on the same ${v.perTask.length} drills (${sign}${Math.abs(v.delta).toFixed(1)}).`);
      moment(w, { kind: 'verdict', verdict: v });
      say(w, v.accepted ? 'accepted' : 'rejected', { delta: `${sign}${Math.abs(v.delta).toFixed(1)}%`, drills: v.perTask.length, title: v.title }, 'gatekeeper');
      if (v.accepted) w.generation++;
    },
  });
  t += 6;
  b.push({
    at: t,
    run: (w) => {
      w.evalRun = null;
      bump(w, 'eval');
    },
  });
  return t;
}

const BEATS = beats();
export const TIMELINE_LENGTH = BEATS[BEATS.length - 1]!.at + 0.5;
export const BEAT_NAMES = BEATS.filter((b) => b.name).map((b) => ({ name: b.name!, at: b.at }));

/**
 * Runs the timeline: `advance(dt)` moves the clock and applies the beats crossed; at the end it
 * starts over from a fresh world. `seek(t)` rebuilds the world at time `t` (for screenshots).
 */
export class Timeline {
  world: World = initialWorld();
  private next = 0;
  paused = false;
  speed = 1;

  advance(dt: number): void {
    if (this.paused) return;
    this.world.t += dt * this.speed;
    while (this.next < BEATS.length && BEATS[this.next]!.at <= this.world.t) BEATS[this.next++]!.run(this.world);
    if (this.world.t >= TIMELINE_LENGTH) this.seek(0);
  }

  seek(t: number): void {
    const old = this.world.rev;
    this.world = initialWorld();
    // Keep revisions increasing so every view redraws.
    for (const k of Object.keys(old) as (keyof World['rev'])[]) this.world.rev[k] = old[k] + 1;
    this.next = 0;
    this.world.t = 0;
    while (this.next < BEATS.length && BEATS[this.next]!.at <= t) BEATS[this.next++]!.run(this.world);
    this.world.t = t;
  }

  seekBeat(name: string, offset = 0): void {
    const b = BEAT_NAMES.find((x) => x.name === name);
    if (b) this.seek(b.at + offset);
  }

  /** Jumps to the next / previous named beat. */
  step(dir: 1 | -1): void {
    const t = this.world.t;
    const list = BEAT_NAMES.map((b) => b.at);
    const target = dir > 0 ? list.find((a) => a > t + 0.01) ?? 0 : [...list].reverse().find((a) => a < t - 0.6) ?? 0;
    this.seek(target + 0.01);
  }
}
