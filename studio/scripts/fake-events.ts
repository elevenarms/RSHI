/**
 * A realistic simulated crew run, as the list of `CrewEvent`s the real crew would emit, with
 * timestamps: baseline, two generations (one proposal accepted, one rejected) and an exam with
 * an improvement on held-out levels. Deterministic (seeded), so tests and screenshots are stable.
 */

import type {
  CrewEvent,
  CrewEventInput,
  Decision,
  EpisodePurpose,
  EpisodeSummary,
  Genome,
  ItemOutcome,
  Lesson,
  PlacementStat,
  Role,
} from '@spotless/crew/contracts';

export interface FakeRunOptions {
  readonly runId?: string;
  readonly start?: Date;
  /** Base URL of the watch page (`<base>#<session>&watch`). */
  readonly watchBase?: string;
  readonly seed?: number;
}

interface Task {
  readonly id: string;
  readonly title: string;
  readonly split: 'train' | 'test';
  readonly source: string;
  readonly kinds: readonly string[];
}

const TRAIN: readonly Task[] = [
  { id: 'drill-breakfast', title: 'Breakfast for four', split: 'train', source: 'L03', kinds: ['cereal_bowl', 'cereal_bowl', 'mug', 'mug', 'side_plate', 'side_plate', 'spoon', 'spoon', 'knife', 'tumbler'] },
  { id: 'drill-roast', title: 'Sunday roast', split: 'train', source: 'L07', kinds: ['dinner_plate', 'dinner_plate', 'dinner_plate', 'roasting_tin', 'saucepan', 'wine_glass', 'wine_glass', 'fork', 'fork', 'knife', 'knife', 'serving_bowl'] },
  { id: 'drill-pasta', title: 'Pasta night', split: 'train', source: 'L05', kinds: ['pasta_bowl', 'pasta_bowl', 'saucepan', 'colander', 'tumbler', 'tumbler', 'fork', 'fork', 'ladle'] },
];
const TEST: readonly Task[] = [
  { id: 'heldout-brunch', title: 'Brunch rush', split: 'test', source: 'L09', kinds: ['dinner_plate', 'dinner_plate', 'cereal_bowl', 'mug', 'mug', 'frying_pan', 'tumbler', 'fork', 'knife', 'spoon', 'side_plate'] },
  { id: 'heldout-dinner', title: 'Dinner party for six', split: 'test', source: 'L11', kinds: ['dinner_plate', 'dinner_plate', 'dinner_plate', 'wine_glass', 'wine_glass', 'serving_bowl', 'saucepan', 'roasting_tin', 'fork', 'fork', 'knife', 'knife', 'pasta_bowl'] },
];

const SOILS: Record<string, readonly string[]> = {
  cereal_bowl: ['dried_porridge'],
  mug: ['coffee_ring'],
  side_plate: ['jam'],
  dinner_plate: ['gravy'],
  roasting_tin: ['baked_fat'],
  saucepan: ['burnt_sauce'],
  wine_glass: ['lipstick'],
  serving_bowl: ['gravy'],
  pasta_bowl: ['tomato_sauce'],
  colander: ['starch'],
  frying_pan: ['egg'],
  tumbler: ['milk_film'],
};

const RACK_OF: Record<string, readonly [string, string, string]> = {
  // [good rack, good stance, poor stance]
  cereal_bowl: ['upper_rack', 'mouth_down', 'mouth_up'],
  pasta_bowl: ['lower_rack', 'tilted_30', 'flat'],
  serving_bowl: ['lower_rack', 'mouth_down', 'mouth_up'],
  mug: ['upper_rack', 'mouth_down', 'on_side'],
  tumbler: ['upper_rack', 'mouth_down', 'upright'],
  wine_glass: ['upper_rack', 'mouth_down', 'tilted_30'],
  side_plate: ['lower_rack', 'upright', 'flat'],
  dinner_plate: ['lower_rack', 'upright', 'flat'],
  roasting_tin: ['lower_rack', 'tilted_30', 'flat'],
  saucepan: ['lower_rack', 'mouth_down', 'on_side'],
  frying_pan: ['lower_rack', 'tilted_30', 'flat'],
  colander: ['lower_rack', 'mouth_down', 'upright'],
  fork: ['cutlery_basket', 'upright', 'flat'],
  knife: ['cutlery_basket', 'upright', 'flat'],
  spoon: ['cutlery_basket', 'upright', 'flat'],
  ladle: ['cutlery_basket', 'upright', 'flat'],
};

const MODEL_LOADER = 'nvidia/Nemotron-3.5-Super-VL';
const MODEL_THINK = 'nvidia/Nemotron-3-Super-120B-A12B';
const MODEL_FAST = 'Qwen/Qwen3-235B-A22B-Instruct-2507';

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function baselineGenome(at: string): Genome {
  return {
    id: 'g0-baseline',
    parentId: null,
    generation: 0,
    createdAt: at,
    rationale: 'baseline',
    team: { usePlanner: true, useMemoryBrief: false, preflightCheck: false, briefLessons: 6 },
    prompts: {
      planner: 'You plan how to load a dishwasher. Read the level card and write a short plan: which rack each item goes in and how it should stand.',
      loaderPreamble: 'You are loading a dishwasher in the Spotless game. Load every item so that it comes out clean. Follow the playbook.',
      critic: 'You review one episode of dishwasher loading. Say what worked, what failed, and the lessons worth keeping, each as one sentence.',
    },
    playbook: [
      { id: 'r1', text: 'Plates stand upright in the lower rack, facing the centre spray arm.', tags: ['dinner_plate', 'lower_rack'], evidence: [] },
      { id: 'r2', text: 'Cutlery goes handle-down in the basket, spread over the compartments.', tags: ['cutlery_basket'], evidence: [] },
      { id: 'r3', text: 'Put large pots and tins in the lower rack, at the back.', tags: ['saucepan', 'roasting_tin'], evidence: [] },
    ],
    loader: { model: MODEL_LOADER, reasoningEffort: null, images: false, deniedTools: [], maxTurns: 40 },
  };
}

export function fakeRun(opts: FakeRunOptions = {}): CrewEvent[] {
  const runId = opts.runId ?? 'run-2026-10-17-demo';
  const t0 = (opts.start ?? new Date('2026-10-17T15:00:00.000Z')).getTime();
  const watchBase = opts.watchBase ?? 'http://127.0.0.1:8791/fake/watch.html';
  const rand = rng(opts.seed ?? 7);
  const events: CrewEvent[] = [];
  let clock = 0; // seconds since t0
  const at = (s: number): string => new Date(t0 + Math.round(s * 1000)).toISOString();
  const emit = (s: number, e: CrewEventInput): void => {
    events.push({ ...e, at: at(s), runId } as CrewEvent);
  };
  const status = (s: number, role: Role, st: 'idle' | 'thinking' | 'acting' | 'done' | 'error', label: string, episodeKey?: string): void =>
    emit(s, { type: 'agent_status', role, status: st, label, ...(episodeKey ? { episodeKey } : {}) });
  const msg = (s: number, from: Role, to: Role | 'all', kind: Extract<CrewEvent, { type: 'message' }>['kind'], title: string, body: string): void =>
    emit(s, { type: 'message', from, to, kind, title, body });
  const log = (s: number, text: string, level: 'info' | 'warn' | 'error' = 'info'): void => emit(s, { type: 'log', level, text });

  // ---------------------------------------------------------------- memory model
  const lessons: Lesson[] = [];
  const placements = new Map<string, { kind: string; rack: string; stance: string; n: number; clean: number }>();
  let episodesSeen = 0;
  const genomes: Genome[] = [];
  const decisions: Decision[] = [];
  const memoryEvent = (s: number): void => {
    const placementStats: PlacementStat[] = [...placements.values()].map((p) => ({ ...p, rate: p.n === 0 ? 0 : p.clean / p.n }));
    emit(s, {
      type: 'memory',
      stats: { episodes: episodesSeen, lessons: lessons.length, genomes: genomes.length, decisions: decisions.length },
      topLessons: [...lessons].sort((a, b) => b.confidence - a.confidence).slice(0, 8),
      placementStats,
    });
  };
  const addLesson = (s: number, text: string, tags: string[], source: Lesson['source'], support: number, contradict: number, ep: string): void => {
    const old = lessons.findIndex((l) => l.text === text);
    if (old >= 0) {
      const l = lessons[old]!;
      const sup = l.support + support;
      const con = l.contradict + contradict;
      lessons[old] = { ...l, support: sup, contradict: con, confidence: conf(sup, con), episodeKeys: [...l.episodeKeys, ep], updatedAt: at(s) };
    } else {
      lessons.push({
        id: `L${lessons.length + 1}`,
        text,
        tags,
        source,
        support,
        contradict,
        confidence: conf(support, contradict),
        episodeKeys: [ep],
        createdAt: at(s),
        updatedAt: at(s),
      });
    }
  };
  const conf = (sup: number, con: number): number => Math.round(((sup + 1) / (sup + con + 2)) * (1 - 1 / (sup + con + 2)) * 100) / 100 + 0.2;

  // ---------------------------------------------------------------- episodes
  let episodeNo = 0;
  /** Plays one episode from `s`, returns its end time and summary; quality 0..1 decides placements. */
  const episode = (s: number, task: Task, genome: Genome, purpose: EpisodePurpose, quality: number, opt: { planner: boolean; long?: number } = { planner: true }): { end: number; summary: EpisodeSummary } => {
    episodeNo++;
    const key = `ep${String(episodeNo).padStart(2, '0')}-${task.id}-${genome.id.split('-')[0]}`;
    const sessionId = `s${(0x9a3f00 + episodeNo * 7919).toString(16)}`;
    const items = task.kinds.length;
    const pointsAvailable = items * 10;
    let t = s;
    if (opt.planner) {
      status(t, 'planner', 'thinking', `planning ${task.title}`, key);
      t += 2.2;
      msg(t, 'planner', 'loader', 'plan', `Plan for ${task.title}`, planText(task));
      emit(t, { type: 'model_turn', episodeKey: key, role: 'planner', text: `Plan written for ${task.title}: ${items} items, bowls and glasses up top, plates and pans below.`, toolCalls: [], tokensIn: 2100 + Math.round(rand() * 400), tokensOut: 380 + Math.round(rand() * 120), ms: 2100 });
      status(t + 0.2, 'planner', 'idle', 'plan sent');
    }
    if (genome.team.useMemoryBrief) {
      status(t, 'librarian', 'acting', `brief for ${task.title}`, key);
      emit(t + 0.55, { type: 'model_turn', episodeKey: key, role: 'librarian', text: `Brief for ${task.title}: the lessons that match its kinds and soils.`, toolCalls: [], tokensIn: 1800, tokensOut: 220, ms: 1500 });
      msg(t + 0.6, 'librarian', 'loader', 'brief', `Memory brief: ${task.title}`, briefText(lessons, task));
      status(t + 0.9, 'librarian', 'idle', 'brief sent');
      t += 1;
    }
    emit(t, {
      type: 'episode_started',
      episodeKey: key,
      sessionId,
      watchUrl: `${watchBase}#${sessionId}&watch`,
      taskId: task.id,
      taskTitle: task.title,
      genomeId: genome.id,
      purpose,
      pointsAvailable,
      itemCount: items,
      items: task.kinds.map((kind, i) => ({ itemId: `${kind}_${String(i + 1).padStart(2, '0')}`, kind, soils: SOILS[kind] ?? [], points: 10, label: kind.replace(/_/g, ' ') })),
    });
    status(t, 'loader', 'acting', `${task.title} · ${purpose}`, key);
    let seq = 0;
    let tokensIn = 0;
    let tokensOut = 0;
    const tool = (dt: number, name: string, args: unknown, ok: boolean, summary: string): void => {
      t += dt;
      seq++;
      emit(t, { type: 'tool_call', episodeKey: key, seq, name, args, ok, summary });
    };
    const turn = (dt: number, text: string, calls: string[]): void => {
      t += dt;
      const ti = 3800 + seq * 420 + Math.round(rand() * 600);
      const to = 60 + Math.round(rand() * 140);
      tokensIn += ti;
      tokensOut += to;
      emit(t, { type: 'model_turn', episodeKey: key, role: 'loader', text, toolCalls: calls, tokensIn: ti, tokensOut: to, ms: Math.round(dt * 1000 * 0.8) });
    };
    turn(1.0, `Reading the level card for ${task.title}. ${items} items, ${new Set(task.kinds).size} kinds.`, ['get_level']);
    tool(0.3, 'get_level', {}, true, `${items} items, ${pointsAvailable} points, racks: upper_rack, lower_rack, cutlery_basket`);
    const outcomes: ItemOutcome[] = [];
    const pace = opt.long ?? 1;
    task.kinds.forEach((kind, i) => {
      const itemId = `${kind}_${String(i + 1).padStart(2, '0')}`;
      const [rack, good, poor] = RACK_OF[kind] ?? ['lower_rack', 'upright', 'flat'];
      const right = rand() < quality;
      const stance = right ? good : poor;
      const r = rand();
      if (i % 3 === 0) {
        turn(0.9 * pace, `Where can ${itemId.replace(/_/g, ' ')} go? Asking for slots in the ${rack.replace('_', ' ')}.`, ['list_slots']);
        tool(0.25, 'list_slots', { rack, item_id: itemId }, true, `${3 + Math.floor(r * 6)} slots free in ${rack}; best: row ${1 + Math.floor(r * 3)}`);
      }
      const say = right
        ? stanceReason(kind, good)
        : `${cap(kind)} ${poor.replace(/_/g, ' ')} should be fine here.`;
      turn(0.8 * pace, say, ['place']);
      const refused = rand() < 0.08;
      if (refused) {
        tool(0.3, 'place', { item_id: itemId, rack, stance }, false, `refused: ${itemId} collides with the tine row`);
        turn(0.6 * pace, `Collision. Shifting ${itemId.replace(/_/g, ' ')} one slot to the right.`, ['place']);
      }
      tool(0.35, 'place', { item_id: itemId, rack, stance, slot: 1 + Math.floor(r * 8) }, true, `${itemId} → ${rack} · ${stance} · stable`);
      const clean = right ? rand() < 0.92 : rand() < 0.12;
      outcomes.push({
        itemId,
        kind,
        soils: SOILS[kind] ?? [],
        points: clean ? 10 : right ? 4 : 0,
        loaded: true,
        clean,
        rack,
        stance,
        position_mm: [Math.round(r * 500), Math.round(rand() * 450), rack === 'upper_rack' ? 420 : 120],
        quat_wxyz: [1, 0, 0, 0],
        holdsWater: !right && (stance === 'mouth_up' || stance === 'flat'),
        retainedWaterMl: !right && stance === 'mouth_up' ? 35 : 0,
        movedDuringWash: false,
        residueRegions: clean ? [] : ['inner_base'],
        residualFractionArea: clean ? 0 : 0.18,
      });
    });
    if (genome.team.preflightCheck || rand() < 0.4) {
      turn(0.8, 'Checking the load before the cycle.', ['check_load']);
      tool(0.4, 'check_load', {}, true, `${items}/${items} loaded · spray arm turns freely · ${outcomes.filter((o) => o.holdsWater).length} items may hold water`);
    }
    turn(0.6, 'Everything is in. Shutting the door and starting the cycle.', ['start_cycle']);
    tool(0.3, 'start_cycle', { programme: 'eco' }, true, 'door shut · eco 45°C · wash started');
    status(t, 'loader', 'thinking', `${task.title} · washing`, key);
    emit(t + 0.2, { type: 'wash', episodeKey: key, status: 'started', detail: 'eco 45°C · pre-rinse, main wash, rinse, dry' });
    t += 5.5;
    emit(t, { type: 'wash', episodeKey: key, status: 'done', detail: 'cycle complete · 3 spray passes' });
    const points = outcomes.reduce((a, o) => a + o.points, 0);
    const summary: EpisodeSummary = {
      episodeKey: key,
      runId,
      taskId: task.id,
      split: task.split,
      sourceLevelId: task.source,
      genomeId: genome.id,
      purpose,
      sessionId,
      tier: 'fast',
      points,
      pointsAvailable,
      share: Math.round((points / pointsAvailable) * 1000) / 1000,
      itemsOffered: items,
      itemsLoaded: items,
      itemsClean: outcomes.filter((o) => o.clean).length,
      items: outcomes,
      stopped: 'start_cycle',
      failed: false,
      turns: seq,
      actions: outcomes.length,
      queries: Math.ceil(items / 3),
      rejectedCalls: 0,
      tokensIn,
      tokensOut,
      cachedTokens: Math.round(tokensIn * 0.62),
      loadingS: Math.round(t - s),
      washS: 5.5,
      plan: opt.planner ? planText(task) : null,
      loaderNotes: ['Everything is in. Shutting the door and starting the cycle.'],
      recordPath: `.crew/runs/${runId}/episodes/${key}.json`,
      finishedAt: at(t + 0.3),
    };
    t += 0.3;
    emit(t, { type: 'episode_finished', summary });
    status(t, 'loader', 'done', `${task.title}: ${points}/${pointsAvailable}`, key);
    if (purpose === 'train' || purpose === 'eval') {
      episodesSeen++;
      for (const o of outcomes) {
        const k = `${o.kind}|${o.rack}|${o.stance}`;
        const p = placements.get(k) ?? { kind: o.kind, rack: o.rack ?? '?', stance: o.stance ?? '?', n: 0, clean: 0 };
        p.n++;
        if (o.clean) p.clean++;
        placements.set(k, p);
      }
    }
    return { end: t, summary };
  };

  // ---------------------------------------------------------------- the run
  const g0 = baselineGenome(at(0));
  emit(0, {
    type: 'run_started',
    mode: 'evolve',
    models: {
      planner: 'nvidia/Nemotron-3.5-Lightning-30B',
      loader: 'nvidia/Nemotron-3.5-Super-VL',
      critic: 'nvidia/Nemotron-3-Nano-Omni-Reasoning-30B',
      coach: 'nvidia/Nemotron-3-Super-120B-A12B',
      gatekeeper: 'statistics (local)',
      librarian: 'nvidia/Nemotron-3-Nano-30B-A3B',
    },
    trainTasks: TRAIN.map((t) => ({ id: t.id, title: t.title, items: t.kinds.length })),
    testTasks: TEST.map((t) => ({ id: t.id, title: t.title, items: t.kinds.length })),
    generations: 2,
    gameUrl: 'http://127.0.0.1:8797',
  });
  log(0.1, `crew ${runId}: evolve, 2 generations, 3 train tasks, 2 held-out tasks`);
  log(0.2, `Crusoe Managed Inference: ${MODEL_LOADER} (loader), ${MODEL_THINK} (planner, critic, coach)`);
  genomes.push(g0);
  emit(0.5, { type: 'genome', genome: g0, status: 'baseline' });
  emit(0.6, { type: 'genome', genome: g0, status: 'champion' });
  memoryEvent(0.8);

  // Baseline: the baseline genome on every train task, three at once.
  clock = 1.5;
  emit(clock, { type: 'phase', phase: 'baseline', generation: 0, detail: 'Measuring the baseline genome on the 3 training tasks' });
  status(clock, 'gatekeeper', 'thinking', 'measuring the baseline');
  const baseQ = [0.5, 0.45, 0.55];
  const baseRes = TRAIN.map((task, i) => episode(clock + i * 2.5, task, g0, 'eval', baseQ[i]!));
  clock = Math.max(...baseRes.map((r) => r.end)) + 1;
  const baseShare = mean(baseRes.map((r) => r.summary.share));
  msg(clock, 'gatekeeper', 'all', 'verdict', `Baseline measured: ${pct(baseShare)}`, `Baseline genome g0 scores ${pct(baseShare)} mean share over ${TRAIN.length} validation tasks. This is the bar every candidate must clear.`);
  status(clock, 'gatekeeper', 'idle', `bar: ${pct(baseShare)}`);
  memoryEvent(clock + 0.3);

  let incumbent = g0;
  let incumbentShares = baseRes.map((r) => r.summary.share);

  const generation = (gen: number, proposal: { title: string; hypothesis: string; edit: (g: Genome) => Genome }, candQ: readonly number[], incQ: readonly number[]): void => {
    // Practice
    clock += 1.5;
    emit(clock, { type: 'phase', phase: 'practice', generation: gen, detail: `Generation ${gen}: practice on the training tasks` });
    const practice = TRAIN.slice(0, gen === 1 ? 3 : 2).map((task, i) => episode(clock + i * 3, task, incumbent, 'train', 0.6 + rand() * 0.15, { planner: incumbent.team.usePlanner }));
    clock = Math.max(...practice.map((r) => r.end)) + 1;
    // Review
    emit(clock, { type: 'phase', phase: 'review', generation: gen, detail: `Critic reviews ${practice.length} episodes; Librarian files the lessons` });
    for (const r of practice) {
      const sum = r.summary;
      status(clock, 'critic', 'thinking', `reviewing ${sum.taskId}`, sum.episodeKey);
      msg(clock + 0.3, 'loader', 'critic', 'note', `Episode ${sum.episodeKey} finished`, `${sum.points}/${sum.pointsAvailable} points, ${sum.itemsClean}/${sum.itemsOffered} clean.`);
      clock += 2.4;
      const failed = sum.items.filter((o) => !o.clean);
      const crit = critiqueOf(sum.items);
      emit(clock, { type: 'model_turn', episodeKey: sum.episodeKey, role: 'critic', text: crit.summary, toolCalls: [], tokensIn: 5200, tokensOut: 640, ms: 2400 });
      msg(clock, 'critic', 'librarian', 'critique', `Post-mortem: ${TRAIN.find((t) => t.id === sum.taskId)?.title ?? sum.taskId}`, `Worked: ${crit.worked}\nFailed: ${failed.length ? failed.map((f) => `${f.itemId} (${f.rack}, ${f.stance})`).join(', ') : 'nothing'}\n${crit.summary}`);
      status(clock, 'critic', 'done', `${crit.lessons.length} lessons`);
      status(clock + 0.2, 'librarian', 'acting', 'merging lessons');
      for (const l of crit.lessons) {
        addLesson(clock, l.text, l.tags, 'critic', l.support, l.contradict, sum.episodeKey);
        msg(clock + 0.5, 'librarian', 'coach', 'lesson', l.text, `confidence ${(lessons.find((x) => x.text === l.text)?.confidence ?? 0).toFixed(2)} · tags: ${l.tags.join(', ')}`);
        clock += 0.7;
      }
      memoryEvent(clock + 0.3);
      status(clock + 0.4, 'librarian', 'idle', `${lessons.length} lessons`);
      clock += 0.8;
    }
    // Observed statistics as a lesson.
    addLesson(clock, 'Mugs and tumblers wash clean only mouth down; upright they fill with water.', ['mug', 'tumbler', 'mouth_down'], 'observed', 4 + gen, 0, practice[0]!.summary.episodeKey);
    memoryEvent(clock);
    // Propose
    clock += 1.2;
    emit(clock, { type: 'phase', phase: 'propose', generation: gen, detail: `Coach proposes a change to the genome` });
    status(clock, 'coach', 'thinking', 'reading memory and decisions');
    msg(clock + 0.4, 'librarian', 'coach', 'brief', 'Memory digest for the Coach', briefText(lessons, TRAIN[0]!));
    clock += 3.2;
    const child = proposal.edit(incumbent);
    emit(clock, { type: 'model_turn', episodeKey: `coach-g${gen}`, role: 'coach', text: proposal.hypothesis, toolCalls: [], tokensIn: 9100, tokensOut: 1200, ms: 3200 });
    msg(clock, 'coach', 'gatekeeper', 'proposal', proposal.title, `${proposal.hypothesis}\n\nEdits: ${describeEdits(incumbent, child)}`);
    status(clock, 'coach', 'done', proposal.title);
    genomes.push(child);
    emit(clock + 0.2, { type: 'genome', genome: child, status: 'candidate' });
    memoryEvent(clock + 0.3);
    // Evaluate
    clock += 1.2;
    emit(clock, { type: 'phase', phase: 'evaluate', generation: gen, detail: `Gatekeeper: candidate ${child.id} vs incumbent ${incumbent.id} on the same tasks` });
    status(clock, 'gatekeeper', 'acting', `A/B: ${child.id} vs ${incumbent.id}`);
    const cand = TRAIN.map((task, i) => episode(clock + i * 2, task, child, 'eval', candQ[i]!, { planner: child.team.usePlanner, long: child.team.usePlanner ? 1 : 0.8 }));
    const inc = TRAIN.map((task, i) => episode(clock + 1 + i * 2, task, incumbent, 'eval', incQ[i]!, { planner: incumbent.team.usePlanner }));
    clock = Math.max(...cand.map((r) => r.end), ...inc.map((r) => r.end)) + 1;
    status(clock, 'gatekeeper', 'thinking', 'comparing scores');
    clock += 1.5;
    const cs = mean(cand.map((r) => r.summary.share));
    const is = mean([...inc.map((r) => r.summary.share), ...incumbentShares]);
    const delta = Math.round((cs - is) * 1000) / 1000;
    const accepted = delta > 0.03;
    const decision: Decision = {
      candidateId: child.id,
      incumbentId: incumbent.id,
      proposalTitle: proposal.title,
      accepted,
      incumbentScore: Math.round(is * 1000) / 1000,
      candidateScore: Math.round(cs * 1000) / 1000,
      delta,
      perTask: TRAIN.map((task, i) => ({ taskId: task.id, incumbent: inc[i]!.summary.share, candidate: cand[i]!.summary.share })),
      reason: accepted
        ? `Candidate beats the incumbent by ${pts(delta)} mean share on the same ${TRAIN.length} tasks (threshold +3.0 pts).`
        : `Candidate is ${pts(delta)} vs the incumbent; it does not clear the +3.0 pts threshold. Kept the incumbent.`,
      at: at(clock),
    };
    decisions.push(decision);
    emit(clock, { type: 'decision', decision });
    msg(clock, 'gatekeeper', 'all', 'verdict', `${accepted ? 'ACCEPTED' : 'REJECTED'}: ${proposal.title}`, decision.reason);
    status(clock, 'gatekeeper', 'done', accepted ? `accepted ${child.id}` : `rejected ${child.id}`);
    if (accepted) {
      emit(clock + 0.1, { type: 'genome', genome: child, status: 'accepted' });
      emit(clock + 0.2, { type: 'genome', genome: incumbent, status: incumbent.parentId === null ? 'baseline' : 'accepted' });
      emit(clock + 0.3, { type: 'genome', genome: child, status: 'champion' });
      incumbent = child;
      incumbentShares = cand.map((r) => r.summary.share);
      log(clock + 0.4, `champion is now ${child.id} (${pct(cs)})`);
    } else {
      emit(clock + 0.1, { type: 'genome', genome: child, status: 'rejected' });
      incumbentShares = inc.map((r) => r.summary.share);
      log(clock + 0.4, `kept ${incumbent.id}; ${child.id} rejected (${pts(delta)})`, 'warn');
    }
    memoryEvent(clock + 0.5);
    clock += 1;
    for (const r of ['planner', 'critic', 'coach', 'gatekeeper', 'librarian'] as const) status(clock, r, 'idle', '');
  };

  generation(
    1,
    {
      title: 'Bowls and cups mouth-down up top, check before the cycle',
      hypothesis: 'Most points were lost on bowls and mugs that stood mouth up and held water. Two new rules about stance and a mandatory check_load should fix that without costing turns.',
      edit: (g) => ({
        ...g,
        id: 'g1-mouthdown',
        parentId: g.id,
        generation: 1,
        createdAt: at(clock),
        rationale: 'Bowls and mugs lost the most points standing mouth up; add stance rules and a preflight check.',
        team: { ...g.team, preflightCheck: true, useMemoryBrief: true },
        playbook: [
          ...g.playbook.map((r) => (r.id === 'r3' ? { ...r, text: 'Large pots and tins go in the lower rack at the back, tilted so water runs off.' } : r)),
          { id: 'r4', text: 'Bowls, mugs and glasses go mouth down in the upper rack, never mouth up.', tags: ['cereal_bowl', 'mug', 'wine_glass', 'upper_rack', 'mouth_down'], evidence: ['L1', 'L3'] },
          { id: 'r5', text: 'Before start_cycle, call check_load and fix any item that holds water.', tags: ['general'], evidence: ['L2'] },
        ],
        prompts: { ...g.prompts, loaderPreamble: g.prompts.loaderPreamble + ' Water that pools on an item keeps it dirty: think about how each item drains.' },
      }),
    },
    [0.85, 0.8, 0.86],
    [0.5, 0.48, 0.55],
  );

  generation(
    2,
    {
      title: 'Drop the Planner to save turns',
      hypothesis: 'The planner costs a model call per episode and the playbook already says where things go. Without it the loader may spend its turns better.',
      edit: (g) => ({
        ...g,
        id: 'g2-noplanner',
        parentId: g.id,
        generation: 2,
        createdAt: at(clock),
        rationale: 'The playbook now covers placement; try without the planner.',
        team: { ...g.team, usePlanner: false, briefLessons: 4 },
        playbook: g.playbook.filter((r) => r.id !== 'r2').concat([{ id: 'r6', text: 'Spread cutlery across the basket: forks and knives alternate, never nest spoons.', tags: ['fork', 'knife', 'spoon', 'cutlery_basket'], evidence: ['L4'] }]),
        loader: { ...g.loader, maxTurns: 32 },
      }),
    },
    [0.72, 0.7, 0.8],
    [0.84, 0.8, 0.86],
  );

  // Exam: baseline vs champion on the held-out tasks, never seen before.
  clock += 1.5;
  emit(clock, { type: 'phase', phase: 'exam', generation: 2, detail: `Exam: ${g0.id} vs ${incumbent.id} on ${TEST.length} held-out levels` });
  log(clock, 'exam: held-out tasks are played now for the first time; nothing is written to memory');
  const exB = TEST.map((task, i) => episode(clock + i * 2, task, g0, 'exam-baseline', 0.4 + i * 0.05));
  const exC = TEST.map((task, i) => episode(clock + 1 + i * 2, task, incumbent, 'exam-champion', 0.84 + i * 0.03, { planner: incumbent.team.usePlanner }));
  clock = Math.max(...exB.map((r) => r.end), ...exC.map((r) => r.end)) + 1.5;
  const per = (rs: { summary: EpisodeSummary }[]) => rs.map((r) => ({ taskId: r.summary.taskId, share: r.summary.share, points: r.summary.points, pointsAvailable: r.summary.pointsAvailable }));
  const sumShare = (rs: { summary: EpisodeSummary }[]) =>
    Math.round((rs.reduce((a, r) => a + r.summary.points, 0) / rs.reduce((a, r) => a + r.summary.pointsAvailable, 0)) * 1000) / 1000;
  emit(clock, {
    type: 'exam',
    baseline: { genomeId: g0.id, share: sumShare(exB), perTask: per(exB) },
    champion: { genomeId: incumbent.id, share: sumShare(exC), perTask: per(exC) },
  });
  msg(clock + 0.2, 'gatekeeper', 'all', 'verdict', `Exam: ${pts(sumShare(exC) - sumShare(exB))} on unseen levels`, `Baseline ${pct(sumShare(exB))} → champion ${pct(sumShare(exC))} over ${TEST.length} held-out levels.`);
  clock += 2;
  emit(clock, { type: 'phase', phase: 'done', generation: 2, detail: `Champion ${incumbent.id}` });
  for (const r of ['planner', 'loader', 'critic', 'coach', 'gatekeeper', 'librarian'] as const) status(clock, r, 'idle', '');
  log(clock, 'run complete');
  addStreams(events, rand);
  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return events;
}

// ---------------------------------------------------------------------------------------------
// Token streams: every model turn is preceded by its tokens, as the real crew streams them
// (reasoning first, then the visible answer, then the arguments of each tool call), in batches
// of about 100 ms.
// ---------------------------------------------------------------------------------------------

const REASONING: Record<string, readonly string[]> = {
  loader: [
    'The level card lists the items with their soils. Dried porridge needs the strongest jets, so the bowl goes mouth down. ',
    'Checking the brief: mugs and tumblers only wash clean mouth down; upright they fill with water. ',
    'The lower rack tines are up, plates should face the centre spray arm. Leave a gap so the jets reach the gravy. ',
    'That placement was refused, the rim collides with the plate behind it. Try one slot to the right, or move it to the upper rack. ',
    'Before start_cycle: check_load, read it. If an arm is stopped by a handle, fix that first. ',
    'Cutlery handles down except knives. Spread them out so spoons do not nest. ',
  ],
  planner: ['Group by rack: heavy pans and plates below, bowls and glasses on top, cutlery last. Watch the tall items against the upper arm. '],
  critic: ['Comparing the outcomes with the placements. Items that held water were all on their side or mouth up. The pan in the corner came out clean. '],
  librarian: ['Matching lessons to the kinds and soils on this level card. Mugs: mouth down, high confidence. Plates: face the centre arm. ', 'Placement statistics for bowls favour the upper rack mouth down; include them, drop the stale glassware lesson. '],
  coach: ['Looking across the decisions: the last accepted change added structure before play. The failures cluster on preflight; the loader starts washes with a blocked arm. A mandatory check should help without costing much. '],
};

function addStreams(events: CrewEvent[], rand: () => number): void {
  const run = events.find((e) => e.type === 'run_started') as Extract<CrewEvent, { type: 'run_started' }> | undefined;
  const runId = run?.runId ?? '';
  const out: CrewEvent[] = [];
  let n = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.type !== 'model_turn') continue;
    const end = Date.parse(e.at);
    const ms = Math.max(1200, Math.min(e.ms, 6000));
    const model = run?.models[e.role] ?? 'model';
    const streamId = `st-${++n}`;
    const pool = REASONING[e.role] ?? REASONING['loader']!;
    let reasoning = pool[Math.floor(rand() * pool.length)]!;
    if (e.role !== 'loader' || rand() < 0.5) reasoning += pool[Math.floor(rand() * pool.length)]!;
    // Tool arguments: the next tool calls of this episode with the names the turn asked for.
    const args: string[] = [];
    for (const name of e.toolCalls) {
      const tc = events.slice(i + 1).find((x) => x.type === 'tool_call' && x.episodeKey === e.episodeKey && x.name === name) as Extract<CrewEvent, { type: 'tool_call' }> | undefined;
      args.push(`${args.length ? '\n' : ''}${name} ${JSON.stringify(tc?.args ?? {})}`);
    }
    const parts: { channel: 'reasoning' | 'content' | 'tool_args'; text: string }[] = [
      { channel: 'reasoning', text: reasoning },
      ...(e.text ? [{ channel: 'content' as const, text: `${e.text} ` }] : []),
      ...args.map((a) => ({ channel: 'tool_args' as const, text: a })),
    ];
    const total = parts.reduce((a, p) => a + p.text.length, 0);
    const steps = Math.max(4, Math.round(ms / 100));
    const per = Math.max(3, Math.ceil(total / steps));
    let t = end - ms;
    for (const p of parts) {
      for (let k = 0; k < p.text.length; k += per) {
        out.push({ type: 'stream', streamId, role: e.role, episodeKey: e.episodeKey, model, channel: p.channel, delta: p.text.slice(k, k + per), done: false, at: new Date(t).toISOString(), runId } as CrewEvent);
        t += ms / steps;
      }
    }
    out.push({ type: 'stream', streamId, role: e.role, episodeKey: e.episodeKey, model, channel: 'content', delta: '', done: true, at: new Date(Math.max(t, end - 1)).toISOString(), runId } as CrewEvent);
  }
  events.push(...out);
}

// ---------------------------------------------------------------------------------------------

function mean(xs: readonly number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
const pts = (d: number): string => `${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(1)} pts`;
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');

function stanceReason(kind: string, stance: string): string {
  const k = kind.replace(/_/g, ' ');
  if (stance === 'mouth_down') return `The ${k} goes mouth down so the spray reaches inside and the water drains.`;
  if (stance === 'tilted_30') return `Tilting the ${k} about 30° so it doesn't pool water.`;
  if (stance === 'upright' && kind.includes('plate')) return `The ${k} stands upright between the tines, soiled face to the centre.`;
  return `The ${k} goes ${stance.replace(/_/g, ' ')}.`;
}

function planText(task: Task): string {
  const kinds = [...new Set(task.kinds)];
  return kinds
    .map((k) => {
      const [rack, stance] = RACK_OF[k] ?? ['lower_rack', 'upright'];
      return `• ${k.replace(/_/g, ' ')} → ${rack.replace('_', ' ')}, ${stance.replace(/_/g, ' ')}`;
    })
    .join('\n');
}

function briefText(lessons: readonly Lesson[], task: Task): string {
  const top = [...lessons].sort((a, b) => b.confidence - a.confidence).slice(0, 4);
  if (top.length === 0) return `No lessons yet for ${task.title}.`;
  return top.map((l) => `• (${l.confidence.toFixed(2)}) ${l.text}`).join('\n');
}

function critiqueOf(items: readonly ItemOutcome[]): {
  worked: string;
  summary: string;
  lessons: { text: string; tags: string[]; support: number; contradict: number }[];
} {
  const failed = items.filter((o) => !o.clean);
  const lessons: { text: string; tags: string[]; support: number; contradict: number }[] = [];
  if (failed.some((f) => f.kind.includes('bowl') && f.stance === 'mouth_up'))
    lessons.push({ text: 'Bowls with dried porridge wash clean only mouth down in the upper rack.', tags: ['cereal_bowl', 'dried_porridge', 'upper_rack', 'mouth_down'], support: 2, contradict: 0 });
  if (failed.some((f) => f.holdsWater)) lessons.push({ text: 'Run check_load before the cycle: items that hold water come out dirty.', tags: ['general'], support: 2, contradict: 0 });
  if (failed.some((f) => f.kind.includes('plate') && f.stance === 'flat'))
    lessons.push({ text: 'Plates laid flat shadow each other; stand them upright facing the spray arm.', tags: ['dinner_plate', 'side_plate', 'lower_rack', 'upright'], support: 1, contradict: 0 });
  if (failed.some((f) => ['fork', 'knife', 'spoon'].includes(f.kind)))
    lessons.push({ text: 'Spoons nest when they share a compartment; spread cutlery across the basket.', tags: ['spoon', 'cutlery_basket'], support: 1, contradict: 1 });
  if (failed.some((f) => ['saucepan', 'roasting_tin', 'frying_pan'].includes(f.kind)))
    lessons.push({ text: 'Tins and pans with baked fat need the lower rack, tilted, facing the lower spray arm.', tags: ['roasting_tin', 'saucepan', 'baked_fat', 'lower_rack'], support: 1, contradict: 0 });
  if (lessons.length === 0) lessons.push({ text: 'Glasses mouth down in the upper rack came out spotless.', tags: ['wine_glass', 'tumbler', 'upper_rack'], support: 1, contradict: 0 });
  return {
    worked: `${items.length - failed.length} of ${items.length} items clean`,
    summary: failed.length
      ? `${failed.length} items came out dirty, mostly ${[...new Set(failed.map((f) => f.kind.replace(/_/g, ' ')))].slice(0, 3).join(', ')}; most of them held water.`
      : 'A clean sweep: every item came out spotless.',
    lessons: lessons.slice(0, 3),
  };
}

function describeEdits(a: Genome, b: Genome): string {
  const parts: string[] = [];
  const ids = new Set(a.playbook.map((r) => r.id));
  for (const r of b.playbook) if (!ids.has(r.id)) parts.push(`add_rule "${r.text}"`);
  for (const r of a.playbook) if (!b.playbook.some((x) => x.id === r.id)) parts.push(`remove_rule ${r.id}`);
  for (const [k, v] of Object.entries(b.team)) if ((a.team as Record<string, unknown>)[k] !== v) parts.push(`set_team ${k}=${String(v)}`);
  return parts.join('; ');
}
