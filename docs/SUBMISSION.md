# Crew: project summary

Crusoe x Cerebral Valley Recursive Agents Hackathon. Full technical description:
[README.md](README.md).

## What it does

Crew (`packages/crew`, package `@spotless/crew`) is an agent team on Crusoe Managed Inference that
plays Spotless, the dishwasher-loading game of DishwasherBench, and improves itself across runs.
After each generation it reviews its episodes item by item, proposes changes to its own prompts,
playbook, tool policy and team structure, and keeps a change only if it scores better than the
current version on the same fresh validation tasks. Improvement is measured on an exam of held-out
levels.

## Task and score

- An LLM loads a 3D model of a Bosch SMV4HAX40G dishwasher with rigid-body physics through 13 MCP
  tools.
- A deterministic GPU wash simulation (jets, droplets, run-off, soil chemistry) scores each item
  that comes out clean.
- Score: points earned / points available (share, 0 to 1). The same load always gives the same
  score. No LLM judge is involved.

## How it works

- **Roles.** Planner (`zai-org/GLM-5.3-Flash`), Loader (`deepseek-ai/DeepSeek-V4.1-Flash`, tools
  and images), Critic (`deepseek-ai/DeepSeek-V4-Pro`, thinking), Coach (`zai-org/GLM-5.3`),
  Librarian (memory, deterministic code), Gatekeeper (statistics, deterministic code).
- **Genome.** The rewritable part of the team: role prompts, a playbook of rules with evidence
  links, tool policy (denied tools, enforced `check_load` before `start_cycle`), team structure
  (planner on/off, memory brief on/off), loader settings (reasoning effort, images, turn limit).
  Immutable and versioned with lineage; changed only through typed edits (`add_rule`,
  `edit_rule`, `remove_rule`, `set_prompt`, `set_team`, `set_loader`).
- **Memory.** Episodic (every episode, item by item), semantic (lessons with support and
  contradiction counts and Bayesian confidence, plus lessons derived from placement statistics),
  procedural (genomes, Gatekeeper decisions, champion). Persists across runs. Exam episodes are
  stored apart and never learned from.
- **Generation.** Practice on training drills, Critic review into memory, Coach proposes 1-3
  candidate genomes (told which past ideas were rejected), each candidate and the incumbent play
  the same fresh validation drills, Gatekeeper accepts a candidate only if its mean share
  improves by at least the margin and failures do not increase.
- **Exam.** Training drills come from course levels 1-4; exam drills from levels 5-7, which
  contain item kinds and soils absent from training. Baseline genome (generation 0) and champion
  play the same exam drills and seeds.
- **Studio.** `apps/studio` at http://127.0.0.1:8790: team graph, live 3D view, loader stream,
  evolution chart with lineage, memory panel, exam results. Runs can be replayed.
- **Crusoe.** OpenAI-compatible Serverless Inference (`api.inference.crusoecloud.com/v1`),
  byte-stable prompts for prefix caching, per-model client-side rate limiting with jittered
  backoff on 429/503.

## How to run

```sh
pnpm install
echo 'CRUSOE_API_KEY=...' >> .env
pnpm --filter @spotless/crew crew smoke
pnpm --filter @spotless/crew crew evolve --generations 3 --exam
open http://127.0.0.1:8790
pnpm --filter @spotless/crew crew exam
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

Top lessons:

{{TOP_LESSONS}}

## Limits

- Same machine, same physics, same wash programme for training and exam.
- The models are stochastic; repeats, if run, are reported individually.
- Few validation drills per generation, bounded by time and rate limits.
