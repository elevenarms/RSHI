# SPARKLETEAM: project summary

Crusoe x Cerebral Valley Recursive Agents Hackathon. Full technical description:
[README.md](README.md). Paper: *Towards Recursive Self Home Improvement*.

## What it does

SPARKLETEAM (the crew: `packages/crew`, package `@spotless/crew`) is an agent team on Crusoe Managed Inference that
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

- **Roles.** Loader (`nvidia/NVIDIA-Nemotron-3.5-Super-VL`, thinking off, tools and images),
  Planner (Nemotron-3.5-Super-VL), Critic (`nvidia/Nemotron-3-Nano-Omni-Reasoning-30B-A3B`, with
  pictures of the final load), Coach (`nvidia/NVIDIA-Nemotron-3-Super-120B-A12B`), Librarian
  (`nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` for the brief, plus memory code), Gatekeeper
  (statistics, deterministic code).
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
  play the same exam drills and seeds. Everything runs on the fast wash tier, 8 shards.
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

Final run `2026-10-17T20-49-49-evolve` (archived in `packages/crew/runs/`):

| | |
| --- | --- |
| Generations | 3 (fast tier, 8 shards) |
| Candidates accepted / proposed | 2/6 (both memory-derived playbook rules) |
| Exam, baseline (gen 0) | 46.0% |
| Exam, champion | 63.7% |
| Delta | +17.8 pp (better on 3 of 4 held-out drills) |
| Evolution wall-clock time | 22.7 min |
| Tokens | 38.3M in (32.0M cached), 0.49M out |

Accepted: a rule against the bowl placement that kept failing (+0.251 on validation), and
placement rules for glasses and cutlery (+0.157). Top lessons: tilt glasses mouth-down in the
upper rack; load cutlery upright in the cutlery basket; tomato-sauce items on the lower rack on edge.

## Limits

- Same machine, same physics, same wash programme for training and exam.
- The models are stochastic; repeats, if run, are reported individually.
- Few validation drills per generation, bounded by time and rate limits.
