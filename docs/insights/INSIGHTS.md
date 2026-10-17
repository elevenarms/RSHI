# Insights from the crew's research runs

Every number below was measured in this repository's simulator, and the data and scripts are linked. Sections are added as the experiments finish.

## FINDING 1: a cup stood mouth up keeps half its grime

**Cups, mugs, glasses and ramekins loaded mouth up came out clean 0 times in 11 and kept 49% of their soil; mouth down, 26 of 26 came out clean, with no measurable soil left.**

| Hollow drinkware and ramekins, washed alone | P(clean) | Soil left (residual mass fraction) | Water retained per item |
|---|---|---|---|
| Mouth down (0 to 45 degree tilt) | **100%** (26/26) | **0.000** | **0 ml** |
| On its side | 25% (2/8) | 0.038 | 1 ml |
| Mouth up | **0%** (0/11) | **0.488** (95% CI 0.28 to 0.71) | **224 ml** (95% CI 140 to 302) |

Bowls behave differently. Mouth up, all 8 still came out clean, but each kept an average **1.17 L of wash water** (95% CI 0.66 to 1.78 L) against 0 ml mouth down. One upturned 4-quart mixing bowl held 2.9 L, so much that the sump ran short and the pump drew air (`pump_starved`). Over all 15 hollow items that reached both stances, the paired difference in P(clean) is 60 percentage points (95% CI 33 to 87); the odds ratio is about 130 with the 0.5 correction. The mouth-down tilts (0, 15, 30, 45 degrees) were all perfect, so no best angle stands out.

**Method.** We took every hollow kind in the course levels (two soil variants per kind, with their level soils) and washed each item alone in its natural rack, at the same game-ranked slot, in each stance: mouth up, mouth down at 0/15/30/45 degrees, and on its side. Each wash was a deterministic fast-tier wash, 108 in all (73 came to rest in a classifiable stance and washed). Analysis uses the stance the item actually settled in, classified from its final pose, not the stance asked for.

**Caveat.** This is one simulated machine (Bosch SMV4HAX40G), one programme (Eco 50) and the fast tier. Each item was washed alone, not inside a full load, and the per-kind samples are small (one or two soil variants each). The effect itself is long known (the benchmark's own `docs/benchmark/levels.md`, the "Mouth up" column and section on hollow pieces, and `docs/research/standards.md` phenomenon P01, "Hollow item loaded open side up"), so what is new is the number, measured in this simulator, not the discovery.

*Data:* [`data/physics-hollow-results.csv`](data/physics-hollow-results.csv) (one row per wash, with its session id), [`data/physics-hollow-analysis.md`](data/physics-hollow-analysis.md). *Scripts:* `packages/crew/scripts/physics-hollow.ts` (the sweep) and `packages/crew/scripts/analyse-hollow.ts` (the analysis).

*Note on the verdict:* the game counts a mouth-up bowl that holds pooled water as clean when no soil residue remains. The water is reported separately above.

## FINDING 2: on 12 held-out drills, the evolved playbook is a wash (statistically)

The champion G2-704108 (three playbook rules) against the baseline G0-fc671e (the bare Super-VL loader, thinking off) on 12 held-out test drills (seeds 0 to 11 across mixed-family, baking-day and dinner-party, 12 items each, fast tier), played twice each. That gives 24 paired episodes, all valid. Runs: `2026-10-17T21-34-04-exam`, `2026-10-17T21-50-44-exam`.

| | Value |
|---|---|
| Mean share | baseline 0.470, champion 0.466 |
| Mean paired delta | **-0.005**, bootstrap 95% CI [-0.130, +0.111] |
| Champion wins / losses / ties | 12 / 10 / 2 |
| Sign test (exact, two-sided) | p = 0.83 |
| Wilcoxon signed-rank | W = 117 (n = 22), p = 0.76 |
| By source | mixed-family +0.073 (3/8 wins), baking-day +0.016 (5/8), dinner-party -0.102 (4/8) |

**Noise dominates.** The same genome on the same drill, played twice, differs by 0.20 share on average (up to 0.80); 6 of 47 episodes scored 0. With a per-drill standard deviation of about 0.3, 24 pairs can only resolve effects of roughly ±0.12. The gains the Gatekeeper measured during evolution (+0.13 to +0.18 on 3 to 4 validation drills) are within this noise. Data: [`data/exam-12-drills-analysis.md`](data/exam-12-drills-analysis.md).

## FINDING 3: no single rule carries a gain; the bowl rule looks superstitious

Each of the champion's three rules, added to the baseline alone or removed from the champion, on the same 12 held-out drills, once each (run `2026-10-17T21-50-11-ablation`). Deltas are paired per drill against the exam baseline (mean of its 2 repeats).

| Variant | Mean share | Δ vs baseline [95% CI] | Wins/losses | Sign p |
|---|---|---|---|---|
| baseline (exam, mean of repeats) | 0.470 | | | |
| champion (exam, mean of repeats) | 0.466 | -0.005 | | |
| baseline + R1.1 (cereal bowl: not upper-rack tilted 45°) | 0.419 | -0.051 [-0.24, +0.13] | 7/5 | 0.77 |
| baseline + R2.1 (glasses: upper rack, mouth down) | 0.506 | +0.035 [-0.13, +0.19] | 7/5 | 0.77 |
| baseline + R2.2 (cutlery: basket, upright) | 0.463 | -0.007 [-0.17, +0.16] | 6/6 | 1.00 |
| champion - R1.1 | **0.552** | +0.082 [-0.08, +0.25] | 7/5 | 0.77 |
| champion - R2.1 | 0.522 | +0.052 [-0.08, +0.19] | 7/5 | 0.77 |
| champion - R2.2 | 0.423 | -0.047 [-0.21, +0.13] | 4/8 | 0.39 |

None of these differences is significant. The pattern is still consistent with the physics, though: R1.1 was written from 1 failure in 2 loads (memory: `cereal_bowl_vitrelle_159 upper_rack mouth_down_tilted_45: 1/2`), but in the controlled sweep every mouth-down bowl, tilted 45° included, washed clean (Finding 1). Removing R1.1 gave the best variant. Data: [`data/ablation-analysis.md`](data/ablation-analysis.md).

## FINDING 4: what the team learned, checked against controlled physics

The memory (`.crew/memory-supervl`, 31 episodes, 73 lessons; dump in [`data/memory-supervl-stats-lessons.txt`](data/memory-supervl-stats-lessons.txt)) compared with deterministic single-item washes (Finding 1, plus a sweep of the other kinds in all their presets, [`data/physics-other-results.csv`](data/physics-other-results.csv); 130 washes, though large pans, boards and bakeware mostly found no accepted placement at a forced preset).

| Team belief (memory) | Physics (controlled) | Verdict |
|---|---|---|
| "Tilt glasses mouth-down in the upper rack" (lesson, +4/-0); stats: tumbler mouth_down 9/11, tilted_30 10/10 | Drinkware mouth down 26/26 clean at 0 to 45°; mouth up 0/11 | **Right** (and the size of the effect was never seen by the team: it never stood a cup mouth up) |
| "Load cutlery upright in the cutlery basket" (+4/-0); forks 28/28, spoons 24/24 | Handle down and handle up both clean for forks, spoons, knives, salad forks and serving spoons; flat, flat_inverted and on_edge never found an accepted placement in the basket | **Right**; the direction of the handle did not matter here |
| "Place items with tomato sauce on the lower rack on edge" (+3/-0) | Dinner, dessert and bread plates and platters came out clean in every stance that settled (leaning 30 to 60°, flat, flat-inverted); a plate flat face up held 137 to 1,194 ml of water but was still clean | **Right but not specific**: the stance hardly matters for plates alone |
| R1.1: avoid cereal bowls upper-rack tilted 45° (from 1/2) | Mouth-down bowls 18/18 clean, including tilted 45° | **Superstitious** (small sample) |
| "Pre-rinse avocado-soiled glasses", "pre-treat yoghurt" (critic lessons) | The game has no such action | **Not actionable** |
| (nothing) | Saucepans and stockpots: mouth up kept 95 to 100% of their soil and held 2.0 to 7.0 L of water; laid "inverted" they settled on their side and stayed dirty (12 to 38% soil left) | **Missed**: pots are the hardest items; no clean stance was found for a pot alone |
| (nothing) | Steel lid: face up clean, face down 57% of its soil left | **Missed** |
| (left out: cereal bowls 0/21 loaded, ramekins 0/11, mugs 0/9 left out) | Every bowl kind washes clean mouth down | **Missed opportunity**: the largest loss is pieces never loaded |

**Takeaway.** The team's few confident lessons are physically right. The gains it could still make are in what it never tried: loading the bowls it leaves out, and finding a stance for pots.
