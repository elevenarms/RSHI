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
