# Crew: a dishwasher-loading team that gets better with experience

Crew (`packages/crew`, package `@spotless/crew`) is a team of agents on
[Crusoe Managed Inference](https://crusoe.ai) that plays Spotless, the dishwasher-loading game of
DishwasherBench, and improves itself between runs. After every generation it reviews what worked
item by item, rewrites its own prompts, playbook, tool policy and team structure, and keeps a
change only if it scores measurably better on fresh tasks. The proof is a before-and-after exam on
levels the team never trained on.

Built for the Crusoe x Cerebral Valley Recursive Agents Hackathon.

## Contents

- [Why this domain](#why-this-domain)
- [The team](#the-team)
- [The loop](#the-loop)
- [The genome](#the-genome)
- [Memory](#memory)
- [The Gatekeeper](#the-gatekeeper)
- [The exam](#the-exam)
- [Studio](#studio)
- [Crusoe usage](#crusoe-usage)
- [How to run](#how-to-run)
- [Results](#results)
- [Where things are](#where-things-are)

## Why this domain

Self-improvement needs a reward that cannot be argued with. Most agent tasks are scored by an LLM
judge, which can be flattered, drifts between versions and rewards confident prose.

Spotless is scored by physics. An LLM loads a 3D model of a real Bosch SMV4HAX40G through 13 MCP
tools (`place`, `remove`, `set_rack`, `list_slots`, `check_load`, `start_cycle` and the rest),
with rigid-body physics on exact shapes. A deterministic GPU wash simulation (jets from the
measured nozzle positions, droplets, run-off, soil and detergent chemistry) then decides which
items come out clean, and the team earns points for each one.

- **Objective.** The score is points earned over points available. No judge, no rubric.
- **Deterministic.** The same load always settles the same way and always washes to the same
  score. The only noise in an evaluation is the model's own sampling.
- **Unfakeable.** The team cannot talk its way to a higher score. A bowl mouth-up under a dead
  spot of the spray arm stays dirty however the agent describes it.
- **Rich enough to learn.** Item kind, soil, rack, stance and neighbours all matter, and every
  episode returns item-level outcomes (clean, holds water, residue) to learn from.

## The team

Each model role runs on a Crusoe-served open model. Roles are spread across models so each stays
within its own per-model rate limit.

| Role | Runs on | Job |
| --- | --- | --- |
| Planner | `zai-org/GLM-5.3-Flash` | Writes a loading plan from the level card and the memory brief. |
| Loader | `deepseek-ai/DeepSeek-V4.1-Flash` | Plays the game: MCP tools plus rendered images of the racks. |
| Critic | `deepseek-ai/DeepSeek-V4-Pro` (thinking) | Item-by-item post-mortem of each episode; emits lessons. |
| Coach | `zai-org/GLM-5.3` | Proposes typed edits to the team's own genome. |
| Librarian | deterministic code | Memory: stores episodes, merges lessons, writes the brief. |
| Gatekeeper | deterministic code | Statistics: accepts or rejects each candidate genome. |

The two judging roles, Librarian and Gatekeeper, are code on purpose: the team can change how it
plays, never how it is graded.

## The loop

```mermaid
flowchart LR
    subgraph G["One generation"]
        P["1. Practice<br/>incumbent plays train drills"] --> R["2. Review<br/>Critic post-mortems"]
        R --> M[("Memory<br/>episodic / semantic / procedural")]
        M --> C["3. Propose<br/>Coach writes 1-3 child genomes"]
        C --> E["4. Evaluate<br/>candidates + incumbent on the SAME fresh validation drills"]
        E --> K{"5. Gatekeeper<br/>better by margin,<br/>no more failures?"}
        K -- accept --> I["New incumbent"]
        K -- reject --> M
    end
    I --> P
    I -. after last generation .-> X["Exam on held-out levels 5-7<br/>baseline gen 0 vs champion"]
```

Inside one episode:

```
 level card + memory brief
          |
       Planner ---- plan ----> Loader <---- 13 MCP tools + images ----> Spotless game server
                                 |                                         (Jolt physics)
                           start_cycle (after enforced check_load)
                                 |
                                 v
                    deterministic GPU wash  -->  item outcomes, points / points available
                                 |
                              Critic  -->  lessons  -->  Librarian (memory)
```

## The genome

The genome is everything the team may rewrite about itself. It is immutable and versioned: a
change never edits a genome in place, it produces a child with a `parentId`, a generation number
and the Coach's rationale, so the full lineage is kept and diffable.

| Part | Contents |
| --- | --- |
| Prompts | Planner system prompt, loader preamble, Critic system prompt. |
| Playbook | Loading rules, each with tags (item kind, soil, rack) and evidence links to the lessons that support it. |
| Tool policy | Tools denied to the loader; enforced preflight (no `start_cycle` before a `check_load` the loader has read). |
| Team structure | Planner on/off, memory brief on/off, number of lessons in the brief. |
| Loader settings | Reasoning effort, images on/off, turn limit. |

The Coach can only change it through typed edits: `add_rule`, `edit_rule`, `remove_rule`,
`set_prompt`, `set_team`, `set_loader`. Each proposal carries a title and a falsifiable
hypothesis, and the Coach is told which past ideas were rejected so it does not retry them.

## Memory

Three layers, persisted under `.crew/`, so the team's history accumulates across runs.

- **Episodic.** Every episode, item by item: kind, soils, rack, stance, clean, holds water,
  residue, plus turns, tokens and how the loader stopped.
- **Semantic.** Lessons with support and contradiction counts and a Bayesian confidence,
  deduplicated on merge. Two sources: lessons the Critic writes, and *observed* lessons derived
  automatically from placement statistics (clean rate per item kind, rack and stance).
- **Procedural.** Every genome, every Gatekeeper decision with its per-task scores, and the
  current champion.

Exam episodes are stored apart and are never read back into memory.

## The Gatekeeper

Each candidate and the incumbent play the same fresh validation drills with the same seeds. This
is a paired comparison: because the wash is deterministic, the task difficulty cancels out and the
difference per task is the effect of the genome plus the model's sampling noise. Comparing against
a historical score instead would mix in which drills happened to be drawn.

A candidate is accepted only if:

1. its mean score share on the validation drills beats the incumbent's by at least the margin
   (`{{MARGIN}}`), and
2. it has no more failed episodes (provider errors, turn or token budget exhaustion) than the
   incumbent.

Otherwise it is rejected, and the rejection (title, hypothesis, per-task deltas, reason) is
written to procedural memory, where the Coach sees it next time.

## The exam

The proof is a held-out exam.

- **Training drills** are drawn from course levels 1-4: tutorial, lunch for four, weeknight
  dinner, breakfast.
- **Exam drills** are drawn from levels 5-7: everyday family load, baking day, dinner party.

"Unseen" here means more than new seeds. The exam levels contain item kinds and soils that
training never showed: a baby bottle and teat, beakers with spouts, lunch tubs, a baking tray, a
tin, a rack, a platter, a board, burnt sugar, overnight soils. The champion has to transfer what
it learned about stance, rack and spray coverage to objects it has never handled.

The baseline genome (generation 0) and the champion play the same exam drills with the same seeds,
on the official wash tier. The reported number is the difference in mean score share.

Honest limits:

- Same machine, same physics, same wash programme. The exam tests transfer to new items, soils
  and loads, not to a different dishwasher.
- The models are stochastic. A single exam pass is one sample; where we ran repeats, we report
  each one and the spread.
- The number of validation drills per generation is small, set by time and rate limits, so a
  margin protects against accepting noise but does not make each decision certain.

## Studio

The Studio (`apps/studio`, served at http://127.0.0.1:8790) is mission control for a run:

- **Team graph** with message packets flowing between roles as they talk.
- **Live 3D view** of the loader at work: the game page embedded in watch mode, with cosmetic
  water during the wash (spinning arms, jets, droplets, pool).
- **Loader stream**: its thoughts and tool calls as they happen.
- **Evolution chart**: the incumbent line stepping up, accepted candidates in green, rejected in
  red, and the genome lineage with diffs.
- **Memory panel**: lessons with confidence bars and a placement heatmap.
- **Exam finale**: before and after bars per task.

Any finished run can be replayed at speed with `crew serve --run <id>` and `?replay=<id>&speed=8`.

## Crusoe usage

- OpenAI-compatible Serverless Inference at `https://api.inference.crusoecloud.com/v1`.
- Prefix caching kept byte-stable: the harness never rewrites earlier turns (except folding old
  turns), so long loader episodes hit the cache.
- Client-side per-model rate limiting with jittered exponential backoff on 429 and 503.

## How to run

```sh
pnpm install
echo 'CRUSOE_API_KEY=...' >> .env

# One episode end to end: models reachable, tools work, wash scores
pnpm --filter @spotless/crew crew smoke

# Three generations of self-improvement, then the held-out exam
pnpm --filter @spotless/crew crew evolve --generations 3 --exam

# Watch it live
open http://127.0.0.1:8790

# Exam only: baseline vs current champion
pnpm --filter @spotless/crew crew exam

# Replay a finished run in the Studio
pnpm --filter @spotless/crew crew serve --run <id>
```

## Results

> Placeholders until the run completes.

| | |
| --- | --- |
| Generations | {{GENERATIONS}} |
| Candidates accepted / proposed | {{ACCEPTED}}/{{PROPOSED}} |
| Exam, baseline (gen 0) | {{EXAM_BASELINE}} |
| Exam, champion | {{EXAM_CHAMPION}} |
| Delta | {{DELTA}} |
| Wall-clock time | {{RUN_TIME}} |
| Tokens | {{TOKENS}} |
| Inference cost | {{COST}} |

Per exam task:

{{EXAM_PER_TASK}}

Lineage of accepted changes:

{{LINEAGE}}

Top lessons the team learned:

{{TOP_LESSONS}}

## Where things are

- `packages/crew/src/contracts.ts`: the types (genome, edits, episodes, lessons, decisions, events).
- `packages/crew/src/team`: the roles.
- `packages/crew/src/memory`: the Librarian.
- `apps/studio`: the visualizer.
- `docs/crew/SUBMISSION.md`: short factual project summary.
