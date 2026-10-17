# RSHI: a self-improving agent team that learns to load a dishwasher

RSHI is a team of agents (on Crusoe Managed Inference) that plays Spotless, the dishwasher-loading
game of [DishwasherBench](https://github.com/composo-ai/DishwasherBench), learns from its own
history and keeps only the changes that measurably help, plus a live visualizer of that loop.

## What is original hackathon work and what is not

| Path | Whose | What |
|---|---|---|
| [`crew/`](crew) | **Ours** (hackathon) | The self-improving team engine: Crusoe client, genome, loader policy, coach / planner / critic / librarian, gatekeeper, evolve, exam, memory, SSE server, CLI |
| [`studio/`](studio) | **Ours** (hackathon) | The live visualizer of the crew |
| [`docs/`](docs) | **Ours** (hackathon) | Architecture, submission write-up, Crusoe skill reference |
| [`scripts/`](scripts), [`fork/`](fork), root files | **Ours** (hackathon) | Workspace, provenance and sync tooling |
| `upstream/DishwasherBench` commits after `99b974a` on branch [`rshi`](https://github.com/elevenarms/DishwasherBench/tree/rshi) | **Ours** (hackathon) | Cosmetic front-end changes in `apps/web` only: water FX, watch mode, turntable. Nothing in the simulation or scoring. [Full diff](https://github.com/elevenarms/DishwasherBench/compare/main...rshi) |
| [`upstream/DishwasherBench`](https://github.com/elevenarms/DishwasherBench/tree/rshi) (everything else) | **Upstream**, [composo-ai/DishwasherBench](https://github.com/composo-ai/DishwasherBench), MIT | The game, physics, wash model, levels, scoring, benchmark harness, server, web app. Used unmodified as a git submodule |

Commit-by-commit evidence with original timestamps: [PROVENANCE.md](PROVENANCE.md).
License: [LICENSE](LICENSE) (our code), [NOTICE](NOTICE) (DishwasherBench).

## Architecture and usage

See [docs/README.md](docs/README.md).

Quick start:

```sh
git clone --recurse-submodules https://github.com/elevenarms/RSHI.git && cd RSHI
pnpm install
pnpm build:web && pnpm build:studio
pnpm crew evolve --dry --generations 1   # fake models, no spend; real runs need CRUSOE_API_KEY in .env
```
