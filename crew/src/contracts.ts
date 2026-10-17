/**
 * The contracts of the crew: the types every part of the self-improving team agrees on.
 *
 *  - `Genome`: everything about the team that the team may rewrite (prompts, playbook, tool
 *    policy, team structure, loader settings). A genome is immutable; a change makes a child.
 *  - `GenomeEdit`: one typed change the Coach proposes; `applyEdits` (genome.ts) makes the child.
 *  - `TaskSpec`: one level to play, in the `train` split (the team may learn from it) or the
 *    `test` split (held out: never played before the exam, never written to memory).
 *  - `EpisodeSummary`: what one episode came to, item by item, as the memory keeps it.
 *  - `Lesson`: a piece of semantic memory with its evidence.
 *  - `CrewMemoryApi`: the memory system (memory/).
 *  - `CrewEvent`: what the running system tells the studio (the visualizer), over SSE.
 *
 * Nothing in here touches the wash simulation: the team plays the game through the standard
 * harness tools, and the score is the game's own.
 */

/** The roles of the team. `loader` plays the game; the others think about it. */
export type Role = 'planner' | 'loader' | 'critic' | 'coach' | 'gatekeeper' | 'librarian';

export const ROLES: readonly Role[] = ['planner', 'loader', 'critic', 'coach', 'gatekeeper', 'librarian'];

/** A rule of the playbook: a short imperative the loader is given, with where it came from. */
export interface PlaybookRule {
  readonly id: string;
  readonly text: string;
  /** What it is about: `general`, or an item kind / soil / rack it applies to (free text tags). */
  readonly tags: readonly string[];
  /** Ids of the lessons that support it (memory), if any. */
  readonly evidence: readonly string[];
}

/** Everything about the team that the team may rewrite. */
export interface Genome {
  readonly id: string;
  readonly parentId: string | null;
  readonly generation: number;
  readonly createdAt: string;
  /** Why this genome exists (the Coach's rationale, or "baseline"). */
  readonly rationale: string;
  readonly team: {
    /** The Planner writes a loading plan from the level card (and the memory brief) before play. */
    readonly usePlanner: boolean;
    /** The Librarian's brief (lessons and placement statistics from memory) goes to the planner/loader. */
    readonly useMemoryBrief: boolean;
    /** The loader may not call start_cycle before a check_load that it has read (enforced by the policy). */
    readonly preflightCheck: boolean;
    /** Most lessons from memory in the brief. */
    readonly briefLessons: number;
  };
  readonly prompts: {
    /** System prompt of the Planner. */
    readonly planner: string;
    /** Text put before the playbook in the loader's system prompt (after the harness prompt). */
    readonly loaderPreamble: string;
    /** System prompt of the Critic. */
    readonly critic: string;
  };
  readonly playbook: readonly PlaybookRule[];
  readonly loader: {
    /** Crusoe model id of the loader (exact, from GET /v1/models). */
    readonly model: string;
    /** `reasoning_effort` sent with every loader request; null for the model default. */
    readonly reasoningEffort: string | null;
    /** Pictures from render/preview are passed to the model. */
    readonly images: boolean;
    /** Tools hidden from the loader (by name), e.g. to save the query budget. */
    readonly deniedTools: readonly string[];
    /** Turn limit of one episode. */
    readonly maxTurns: number;
  };
}

/** One change the Coach may propose. */
export type GenomeEdit =
  | { readonly op: 'add_rule'; readonly rule: Omit<PlaybookRule, 'id'> & { readonly id?: string } }
  | { readonly op: 'edit_rule'; readonly id: string; readonly text: string; readonly tags?: readonly string[] }
  | { readonly op: 'remove_rule'; readonly id: string }
  | { readonly op: 'set_prompt'; readonly prompt: keyof Genome['prompts']; readonly text: string }
  | { readonly op: 'set_team'; readonly key: keyof Genome['team']; readonly value: boolean | number }
  | {
      readonly op: 'set_loader';
      readonly key: 'reasoningEffort' | 'images' | 'deniedTools' | 'maxTurns';
      readonly value: string | number | boolean | null | readonly string[];
    };

/** A proposal of the Coach: a set of edits with the hypothesis it tests. */
export interface Proposal {
  readonly id: string;
  readonly title: string;
  readonly hypothesis: string;
  readonly edits: readonly GenomeEdit[];
}

export type Split = 'train' | 'test';

/** One level to play. `level` is a `@spotless/levels` Level (kept as unknown here to stay light). */
export interface TaskSpec {
  readonly id: string;
  readonly split: Split;
  readonly title: string;
  /** The course level the drill's items were drawn from. */
  readonly sourceLevelId: string;
  readonly itemCount: number;
  readonly pointsAvailable: number;
  /** The Level object to give the game server. */
  readonly level: unknown;
}

export type EpisodePurpose = 'train' | 'eval' | 'exam-baseline' | 'exam-champion' | 'smoke';

/** One item of an episode as it came out. */
export interface ItemOutcome {
  readonly itemId: string;
  /** Catalogue kind of the item (e.g. `dinner_plate`), from the level card. */
  readonly kind: string;
  /** Soil ids on the item (from the level card). */
  readonly soils: readonly string[];
  readonly points: number;
  readonly loaded: boolean;
  readonly clean: boolean;
  /** `upper_rack`, `lower_rack`, `cutlery_basket`, ... or null when not loaded / unknown. */
  readonly rack: string | null;
  /**
   * How the item stood, in words a model can use: `mouth_down`, `mouth_up`, `on_side`,
   * `upright`, `flat`, `tilted_<deg>` ... derived from its pose; null when unknown.
   */
  readonly stance: string | null;
  readonly position_mm: readonly number[] | null;
  readonly quat_wxyz: readonly number[] | null;
  readonly holdsWater: boolean;
  readonly retainedWaterMl: number;
  readonly movedDuringWash: boolean;
  readonly residueRegions: readonly string[];
  readonly residualFractionArea: number;
}

/** What one episode came to. */
export interface EpisodeSummary {
  readonly episodeKey: string;
  readonly runId: string;
  readonly taskId: string;
  readonly split: Split;
  readonly sourceLevelId: string;
  readonly genomeId: string;
  readonly purpose: EpisodePurpose;
  readonly sessionId: string | null;
  readonly tier: 'fast' | 'official';
  readonly points: number;
  readonly pointsAvailable: number;
  /** points / pointsAvailable, 0..1: the score that decides. */
  readonly share: number;
  readonly itemsOffered: number;
  readonly itemsLoaded: number;
  readonly itemsClean: number;
  readonly items: readonly ItemOutcome[];
  /** How the loader stopped (`start_cycle`, `max_turns`, `token_budget`, `provider_error`, ...). */
  readonly stopped: string;
  readonly failed: boolean;
  readonly turns: number;
  readonly actions: number;
  readonly queries: number;
  readonly rejectedCalls: number;
  readonly tokensIn: number;
  readonly tokensOut: number;
  readonly cachedTokens: number;
  readonly loadingS: number;
  readonly washS: number;
  /** The plan the Planner wrote, if any. */
  readonly plan: string | null;
  /** The last few things the loader said (for the Critic). */
  readonly loaderNotes: readonly string[];
  /** Path of the bench episode record. */
  readonly recordPath: string | null;
  readonly finishedAt: string;
}

/** A piece of semantic memory. */
export interface Lesson {
  readonly id: string;
  /** One sentence, imperative or factual: "Bowls with dried porridge wash clean only mouth down in the upper rack." */
  readonly text: string;
  /** Item kinds, soils, racks, stances or `general` it is about (lowercase). */
  readonly tags: readonly string[];
  /** `observed` (from statistics), `critic` (from a post-mortem), `coach`. */
  readonly source: 'observed' | 'critic' | 'coach';
  /** Episodes that support it / contradict it. */
  readonly support: number;
  readonly contradict: number;
  /** Confidence 0..1 (from support and contradiction, see memory). */
  readonly confidence: number;
  readonly episodeKeys: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** The Critic's post-mortem of one episode. */
export interface Critique {
  readonly episodeKey: string;
  readonly worked: readonly string[];
  readonly failed: readonly string[];
  /** New or reinforced lessons (memory merges them with what it has). */
  readonly lessons: readonly { readonly text: string; readonly tags: readonly string[]; readonly polarity: 'support' | 'contradict' }[];
}

/** Clean rate of a (kind, rack, stance) cell, from every training episode. */
export interface PlacementStat {
  readonly kind: string;
  readonly rack: string;
  readonly stance: string;
  readonly n: number;
  readonly clean: number;
  readonly rate: number;
}

/** A decision of the Gatekeeper on one candidate. */
export interface Decision {
  readonly candidateId: string;
  readonly incumbentId: string;
  readonly proposalTitle: string;
  readonly accepted: boolean;
  readonly incumbentScore: number;
  readonly candidateScore: number;
  readonly delta: number;
  readonly perTask: readonly { readonly taskId: string; readonly incumbent: number; readonly candidate: number }[];
  readonly reason: string;
  readonly at: string;
}

/** The memory system (memory/index.ts implements it). Every method is synchronous over files. */
export interface CrewMemoryApi {
  /** Episodic: an episode of a train/eval/smoke purpose is kept; exam episodes are kept apart and never learned from. */
  recordEpisode(summary: EpisodeSummary): void;
  episodes(filter?: { readonly genomeId?: string; readonly split?: Split }): readonly EpisodeSummary[];
  /** Semantic: merge the lessons of a critique (dedupe by meaning, update support/contradict and confidence). */
  addCritique(critique: Critique): readonly Lesson[];
  lessons(): readonly Lesson[];
  /** Statistics of placements over training episodes, per (kind, rack, stance). */
  placementStats(): readonly PlacementStat[];
  /**
   * The Librarian's brief for a level: the lessons whose tags match the level's kinds and soils
   * (and general ones), best first, and the placement statistics of its kinds, as text for a prompt.
   */
  briefFor(card: { readonly kinds: readonly string[]; readonly soils: readonly string[] }, maxLessons: number): string;
  /** Procedural: every genome, the decisions, the champion. */
  saveGenome(genome: Genome, status: 'candidate' | 'accepted' | 'rejected' | 'champion' | 'baseline'): void;
  genomes(): readonly { readonly genome: Genome; readonly status: string }[];
  recordDecision(decision: Decision): void;
  decisions(): readonly Decision[];
  champion(): Genome | null;
  /** Counts for the studio. */
  stats(): { readonly episodes: number; readonly lessons: number; readonly genomes: number; readonly decisions: number };
}

/** What the running system tells the studio. Every event carries `at` (ISO time) and `runId`. */
export type CrewEvent = { readonly at: string; readonly runId: string } & (
  | {
      readonly type: 'run_started';
      readonly mode: 'evolve' | 'exam' | 'smoke' | 'replay';
      readonly models: { readonly [role in Role]?: string };
      readonly trainTasks: readonly { readonly id: string; readonly title: string; readonly items: number }[];
      readonly testTasks: readonly { readonly id: string; readonly title: string; readonly items: number }[];
      readonly generations: number;
      readonly gameUrl: string;
    }
  | {
      readonly type: 'phase';
      readonly phase: 'baseline' | 'practice' | 'review' | 'propose' | 'evaluate' | 'exam' | 'done';
      readonly generation: number;
      readonly detail: string;
    }
  | {
      readonly type: 'agent_status';
      readonly role: Role;
      readonly status: 'idle' | 'thinking' | 'acting' | 'done' | 'error';
      readonly label: string;
      readonly episodeKey?: string;
    }
  | {
      readonly type: 'message';
      readonly from: Role;
      readonly to: Role | 'all';
      readonly kind: 'plan' | 'brief' | 'lesson' | 'critique' | 'proposal' | 'verdict' | 'note';
      readonly title: string;
      readonly body: string;
    }
  | {
      readonly type: 'episode_started';
      readonly episodeKey: string;
      readonly sessionId: string;
      /** Address of the game page that shows this episode live (`<gameUrl>/#<sessionId>&watch`). */
      readonly watchUrl: string;
      readonly taskId: string;
      readonly taskTitle: string;
      readonly genomeId: string;
      readonly purpose: EpisodePurpose;
      readonly pointsAvailable: number;
      readonly itemCount: number;
    }
  | {
      readonly type: 'tool_call';
      readonly episodeKey: string;
      readonly seq: number;
      readonly name: string;
      readonly args: unknown;
      readonly ok: boolean;
      /** One line about the result (what moved, what was refused, budgets). */
      readonly summary: string;
    }
  | {
      readonly type: 'model_turn';
      readonly episodeKey: string;
      readonly role: Role;
      /** What the model said (visible text, trimmed), may be empty. */
      readonly text: string;
      readonly toolCalls: readonly string[];
      readonly tokensIn: number;
      readonly tokensOut: number;
      readonly ms: number;
    }
  | {
      /**
       * Tokens as a model streams them, batched (about every 100 ms per stream). `streamId` is
       * one model call; `channel` says whether the text is the model's reasoning, its visible
       * answer, or the arguments of a tool call it is writing. `done` closes the stream.
       */
      readonly type: 'stream';
      readonly streamId: string;
      readonly role: Role;
      readonly episodeKey?: string;
      readonly model: string;
      readonly channel: 'reasoning' | 'content' | 'tool_args';
      readonly delta: string;
      readonly done: boolean;
    }
  | { readonly type: 'wash'; readonly episodeKey: string; readonly status: 'started' | 'done' | 'failed'; readonly detail: string }
  | { readonly type: 'episode_finished'; readonly summary: EpisodeSummary }
  | {
      readonly type: 'genome';
      readonly genome: Genome;
      readonly status: 'baseline' | 'candidate' | 'accepted' | 'rejected' | 'champion';
    }
  | { readonly type: 'decision'; readonly decision: Decision }
  | {
      readonly type: 'memory';
      readonly stats: ReturnType<CrewMemoryApi['stats']>;
      readonly topLessons: readonly Lesson[];
      readonly placementStats: readonly PlacementStat[];
    }
  | {
      readonly type: 'exam';
      readonly baseline: { readonly genomeId: string; readonly share: number; readonly perTask: readonly { readonly taskId: string; readonly share: number; readonly points: number; readonly pointsAvailable: number }[] };
      readonly champion: { readonly genomeId: string; readonly share: number; readonly perTask: readonly { readonly taskId: string; readonly share: number; readonly points: number; readonly pointsAvailable: number }[] };
    }
  | { readonly type: 'log'; readonly level: 'info' | 'warn' | 'error'; readonly text: string }
);

/** Distributes `Omit` over the union, so an event can be emitted without `at` and `runId`. */
export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
export type CrewEventInput = DistributiveOmit<CrewEvent, 'at' | 'runId'>;

/** Where the crew keeps its files, under the repository root. */
export const CREW_DIR = '.crew';
/** Port of the crew's HTTP server (studio page + /api/events SSE + /api/events.json). */
export const CREW_PORT = 8790;
