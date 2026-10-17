# SPARKLETEAM: Towards Recursive Self Home Improvement
### (and the Superstitions It Learned on the Way)

**[Project page](https://elevenarms.github.io/RSHI/) · [Paper (PDF)](docs/paper/main.pdf) · [Slides](docs/launch/deck/SparkleTeam-deck.pdf) · [Video](https://elevenarms.github.io/RSHI/#teaser) · [Run logs](crew/runs)**

Dave Rauchwerk ([@_elevenarms](https://x.com/_elevenarms)) and Claude (Anthropic) · built at the Cerebral Valley × Crusoe Recursive Agents Hackathon, 17 Oct 2026

![The SparkleTeam Studio during a live run: five NVIDIA Nemotron models on Crusoe as a team graph, the weak loader at work in the physically simulated dishwasher, the dirty item in hand, score versus generation with accepted and rejected self-edits, and every token streaming.](studio/screenshots/sparkleteam-figure.png)
<sub>The Studio, replaying the final run during the held-out exam (the washer and turntable panels show representative stills in replay).</sub>

A team of five open NVIDIA Nemotron models on Crusoe Managed Inference plays the dishwasher-loading
game of [DishwasherBench](https://github.com/composo-ai/DishwasherBench) (Composo's physically
simulated Bosch machine, scored by which items come out clean), rewrites its own prompts, playbook,
tools and team structure, and keeps an edit only if it wins a paired, measured test.

- **It works end to end:** typed self-edits, a statistical Gatekeeper, three-layer memory, and every
  token logged and replayable ([`crew/runs/`](crew/runs)).
- **Finding 1:** a cup stood mouth up keeps half its grime. Mouth up: 0 of 11 came out clean.
  Mouth down: 26 of 26 ([details](docs/insights/INSIGHTS.md)).
- **It learned a superstition, and we caught it.** A first 4-drill exam showed +17.8 pp. A 12-drill
  replication (23 pairs) showed −0.3 pp (95% CI −13 to +12): no effect. One accepted rule was real
  physics; the other rested on one failure in two loads. The weak loader's own noise swamped the
  Gatekeeper's margin. The paper gives the design rules that fix it, and fine-tuning as the next
  recursion.

## What is original hackathon work and what is not

| Path | Whose | What |
|---|---|---|
| [`crew/`](crew) | **Ours** (hackathon) | The SPARKLETEAM engine: Crusoe client, genome, loader policy, coach / planner / critic / librarian, gatekeeper, evolve, exam, memory, SSE server, CLI; run archives in `crew/runs/` |
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
