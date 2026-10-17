# SparkleTeam launch video: script

**Working title:** *SparkleTeam: Towards Recursive Self Home Improvement*
**Length:** 3:00 (12 scenes; VO 379 words, about 2:42 of speech at 140 wpm, plus musical breathing room)
**Status:** draft for review. Nothing gets rendered until this is approved.
**Sources of truth:** `docs/crew/paper/main.tex` (all numbers), `packages/crew/runs/2026-10-17T20-49-49-evolve/report.md`
(decisions, genome diff), `packages/levels/src/starter/levels.ts` (items and soils).

---

## 1. Logline and outline

**Logline.** A team of cheap, open Nemotron models takes a deliberately weak loader, learns to load
a physically simulated real dishwasher better by rewriting its own scaffold, keeps only the edits
the physics confirms, and carries the gain to levels it has never seen: 46.0% to 63.7% on a
held-out exam. The evidence is honest and thin, and the video says so.

**Act I: the problem (0:00–0:59).** Agent teams do not get better with experience, and
self-improvement loops are usually graded by an LLM judge that can be flattered. We need a reward
that cannot be argued with. DishwasherBench supplies one: a real Bosch machine, rigid-body
loading, a calibrated GPU wash, and points only for items that come out clean. Into it we put a
weak loader that scores 39%.

**Act II: the method (0:59–1:58).** The team: Planner, Critic, Coach, Librarian, and a
Gatekeeper that is code, not a model. Three-layer memory with Bayesian confidence. A typed genome
the Coach may edit in six ways. A paired Gatekeeper that accepts an edit only if it beats the
incumbent on the same fresh drills by at least 3 pp.

**Act III: the result (1:58–2:37).** Six proposals, two accepted, both short playbook rules
distilled from memory; every structural edit rejected for this loader (while a Lightning pilot
accepted the Planner). On the held-out exam: 46.0% to 63.7%, +17.8 pp, ahead on 3 of 4 drills.

**Coda: what it means (2:37–3:00).** n = 4, sign test p ≈ 0.31: a demonstration, not a proof,
with every throttle and bug reported. Open, inexpensive models and an unfakeable reward are
enough to start recursive self (home) improvement.

---

## 2. Global style

- **Canvas:** 1920×1080, 30 fps (manim `-qh`, 60 fps optional). Background `#FAFAF7` (warm white),
  ink `#111111`, hairline greys `#D0D0CC` / `#8A8A85`.
- **Type:** monospace throughout (JetBrains Mono or IBM Plex Mono). Titles 44 px medium, labels 22 px,
  footnotes 16 px grey. Numbers always tabular.
- **Semantic colour, used sparingly:** green `#2E8B57` = clean / accepted; red `#C0392B` =
  dirty / rejected; amber `#D4A017` = held-out exam. Everything else is black ink.
- **Motion:** `Create` / `Write` for lines and text, 0.6–1.0 s; ease in-out; no bounces, no
  shakes. Cuts between MANIM and 3D are clean cuts or 8-frame dip-to-white.
- **3D look:** the benchmark's three.js web client, neutral studio light, background matched to
  `#FAFAF7` where the client allows, otherwise its own light-grey.
- **Music:** one minimal piece (sparse piano or soft analogue pulse, about 80–90 bpm), mixed
  -24 LUFS under the VO, ducking 6 dB while speaking. Sound design is subtle and diegetic:
  pen ticks, a rack click, a soft water hiss. No whooshes, no risers, no comic stings.
- **VO markup:** "/" = a short natural pause (about 0.4 s). "//" = a held beat (about 1 s).

---

## 3. Shot table

Timecodes are targets; the edit will follow the recorded VO.

### S01 Hook: 0:00–0:13 · MANIM (`Hook`)

**Visual.** White frame. A horizontal axis draws left to right, labelled `run` with ticks `1` and
`100`. A flat black line at 0.40 runs across it ("performance"). A small counter at top right
ticks `run 001 … run 100` while the line stays perfectly flat. On "We wanted a team that does",
a second line in green starts at the same level and begins to step upward, then the frame
freezes mid-step and everything except the green step fades out.

**VO.**
> Most agent teams are as good on run one hundred / as on run one. // They don't remember, / and
> they don't improve. // We wanted a team that does.

**On-screen text.** `run 001 → run 100` (counter); axis label `performance`.
**Sound.** Silence for the first second, then a single low piano note; music enters softly at 0:08.

### S02 The machine: 0:13–0:24 · 3D (`3D-01`), then TITLE

**Visual.** Black-to-white fade into the Bosch SMV4HAX40G, three-quarter front view, door closed.
Slow dolly in; the door opens; the lower rack slides out, then the upper rack. Hold on the empty
racks for one beat. At 0:21 a title card overlays on the white margin: the title types on, the
subtitle fades in below.

**VO.**
> So we gave one a dishwasher. / A real Bosch, / modelled down to its spray arms, / in Composo's
> DishwasherBench.

**On-screen text.** At 0:16, small lower-left: `Bosch SMV4HAX40G · DishwasherBench (Composo, MIT)`.
Title at 0:21: `SparkleTeam` / `Towards Recursive Self Home Improvement`.
**Sound.** A soft door-latch click and rack-roller rumble from the client's own audio (or foley), low.

### S03 Benchmark physics: 0:24–0:47 · 3D (`3D-02`, `3D-03`, `3D-04`) intercut with MANIM (`BenchmarkPhysics`)

**Visual.**
1. (0:24–0:29) 3D-02 turntable: `cereal_bowl_01` turning, yoghurt soil visible inside; cut to
   `frying_pan_01` with fried egg on the base. Each gets a thin monospace caption.
2. (0:29–0:34) 3D-03: items drop into the racks with physics: a plate settles into the tines, a glass
   tips mouth-down, cutlery slides into the basket.
3. (0:34–0:40) 3D-04: door closed, cut-away view: the cosmetic water spray from the arms.
4. (0:40–0:47) MANIM `BenchmarkPhysics`: a top-down schematic of the lower spray arm. Its jets draw
   as fanning lines; one region is left unreached (a "dead spot", hatched grey). A bowl icon sits
   mouth-up in the dead spot. A speech bubble appears beside it with a paragraph of grey lorem-like
   text (`This bowl has been placed with exceptional care…`). The wash sweeps; every other item
   ticks green; the bowl turns red; the speech bubble shrinks to nothing. A formula writes
   underneath: `score = points(clean items) / points available`.

**VO.**
> Items drop into the racks with rigid-body physics. / Then a GPU wash simulation, / calibrated
> against real washes, / decides what comes out clean. / An item scores only if it's clean. // No
> judge. / No rubric. // And you can't sweet-talk physics: / a bowl under a dead spot stays dirty, /
> however eloquently you describe it.

**On-screen text.** Captions: `cereal_bowl · yoghurt, 10 h`, `frying_pan · egg_cooked`;
`Jolt rigid-body physics`; `GPU wash · Eco 50 · calibrated on the real machine`; formula as above;
small footer `objective · deterministic · unfakeable`.
**Sound.** Faint clinks on the drops; a soft water hiss under 3D-04; one dry pen tick when the bowl
turns red.

### S04 The weak loader: 0:47–0:59 · MANIM (`WeakLoader`)

**Visual.** A single node draws centre-frame: a rounded box `Loader` with the model name beneath.
A turn meter (40 small squares) fills one square per tick beside it. Small item icons move into a
rack outline; each that lands turns green (all of them are clean). The meter reaches 40/40 while
most icons still wait outside the rack, greyed. A large number writes on: `39%`.

**VO.**
> Our loader is deliberately weak: / Nemotron 3.5 Super VL, / thinking off. // What it loads
> comes out clean. / It just runs out of turns. // Thirty-nine percent.

**On-screen text.** `Loader · Nemotron-3.5-Super-VL · thinking off`; meter `turns 40/40`;
`39%` with subscript `G0 practice mean share`.
**Sound.** Soft ticks with the turn meter, stopping abruptly at 40.

### S05 The team: 0:59–1:17 · MANIM (`TeamGraph`)

**Visual.** The `Loader` node from S04 stays, moves left of centre. Around it, nodes draw one by
one in the order named, like a constellation: `Planner`, `Critic` (with a small eye glyph: sees
renders), `Coach`, `Librarian` (a small stack glyph), each with its model in grey beneath. Thin
edges connect them; small dots travel along the edges as messages (plan → Loader; episode →
Critic; lessons → Librarian; brief → Coach). Last, `Gatekeeper` draws differently: a square
(not rounded), solid black fill, white text, label `code` instead of a model. A dashed box
encloses everything with the caption `Crusoe serverless inference · open NVIDIA Nemotron`.

**VO.**
> Around it, / a team of open Nemotron models / on Crusoe serverless inference. // A Planner. / A
> Critic that looks at the renders. / A Coach. / A Librarian that keeps the memory. // And one
> member that isn't a model at all: / the Gatekeeper.

**On-screen text.** Node labels and models: Planner · Super-VL; Critic · Nano-Omni-Reasoning-30B;
Coach · Super-120B-A12B; Librarian · Nano-30B-A3B + code; Gatekeeper · deterministic statistics.
**Sound.** A faint soft pluck per node; message dots silent.

### S06 Memory: 1:17–1:30 · MANIM (`MemoryLayers`)

**Visual.** The Librarian node expands into three stacked horizontal slabs, drawn top to bottom.
(1) `episodic`: a strip of tiny item rows filling in (`juice_glass_01 · upper · mouth_down ·
clean` in green, one row in red). (2) `semantic`: three lesson cards slide in, each with a
confidence bar; one bar grows as `s` (support) ticks up `1 → 5 → 20`, its value reading
`0.54 → 0.72 → 0.90`. The equation writes in beside it. (3) `procedural`: a small lineage tree
(`G0 → G1 → G2`) with green and red leaves.

**VO.**
> Memory has three layers. / Episodes, item by item. / Lessons, each with a Bayesian confidence /
> that only physics can raise. // And procedure: / every version of the team, / and why it changed.

**On-screen text.** Layer labels; lesson card `Tilt glasses mouth-down in the upper rack · κ 0.69`;
equation `p = (s+1)/(n+2),  κ = ½ + (p − ½)·n/(n+K),  K = 3`.
**Sound.** None beyond music.

### S07 The genome: 1:30–1:43 · MANIM (`GenomeEdits`)

**Visual.** A code-like card titled `genome G0-fc671e` lists its parts: `prompts`, `playbook (0
rules)`, `team {usePlanner: false, useMemoryBrief: false, preflightCheck: false}`, `loader {…}`.
Six operation chips line up beneath: `add_rule  edit_rule  remove_rule  set_prompt  set_team
set_loader`. One chip (`add_rule`) lifts, slides into the card, and a diff line appears in green:
`+ R2.1  Glasses and tumblers: upper_rack, mouth_down`. A new card id writes in with a parent
pointer. On "Never how it's graded", a separate locked box at right, `scoring · physics + Gatekeeper`,
gets a padlock glyph; an arrow from the Coach toward it draws, stops short, and fades.

**VO.**
> Between generations, the Coach rewrites the team's genome: / prompts, playbook, tools,
> structure, / through six typed edits. // The team can change how it plays. / Never how it's
> graded.

**On-screen text.** As described; footer `ids hash content + parent: lineage is diffable`.
**Sound.** A soft keyboard-like tick as the diff line types.

### S08 The Gatekeeper: 1:43–1:58 · MANIM (`Gatekeeper`)

**Visual.** Three drill columns label in: `Tutorial`, `Lunch`, `Weeknight` with a seed tag on each
(`same seed`). For each drill, two bars grow side by side: incumbent (grey) and candidate (black).
Bars of very different heights per drill (to show drill difficulty swamps everything). Then
thin connector lines pair each bar couple, and the per-drill differences drop down into a single
row as small signed numbers; they sum into `Δ̄` which slides onto a horizontal threshold line at
`δ = 0.03`. Example shown: the generation-2 bowl rule, `.443 → .695, Δ̄ = +0.251`; the gate line
turns green and stamps `ACCEPT`. Quick replay with the preflight edit: `Δ̄ = −0.109`, red, `REJECT`.

**VO.**
> An edit survives only if it beats the incumbent / on the same fresh drills, / same seeds, / by
> at least three points. // Pairing cancels the luck of the draw. / What's left is the edit.

**On-screen text.** `accept ⇔ Δ̄ ≥ δ = 0.03`; small footnote `void if fewer than 3 paired drills`.
**Sound.** One soft stamp (felt, not a thud) per verdict.

### S09 Evolution: 1:58–2:18 · MANIM (`Evolution`) with a 3 s UI insert

**Visual.** A staircase chart: x = generation `G1 G2 G3`, y = validation share. Six proposal dots
appear two per generation, each with its abridged title. Rejected dots go red and drop to a
"rejected" shelf at the bottom with a thin strike-through; accepted dots go green and the incumbent
line steps up onto them: `.449` (G1, both rejected, flat) → `.695` (G2, bowl rule) → `.775` (G3,
glasses and cutlery). On "glasses mouth-down, cutlery upright", the two rule texts type in beside
the top step. At 2:08–2:11 cut to the Studio UI (`UI-01`): slow push across the SCORE panel of
`sparkleteam-figure.png`. Back to manim: a second, faint ghost chart labelled `Lightning pilot`
slides in at half size, where the `Planner` dot is green (`+0.135`). The two `Planner` dots, red
and green, are connected by a dotted line.

**VO.**
> Six proposals. / Two accepted. // Both were short playbook rules, / distilled from memory: /
> glasses mouth-down, / cutlery upright. // The Planner, / the memory brief, / the preflight check:
> / all rejected, / for this loader. // On a different loader, the Planner won. / The right scaffold
> has to be measured, / not assumed.

**On-screen text.** Proposal titles (abridged, from Table 3): `Enable Planner` · `Memory brief,
expanded` · `Enable preflight` · `Avoid poor bowl placement` · `Memory brief, focused` · `Rules
for glasses & cutlery`. Footnote `validation share; fresh seeds each generation`. Ghost chart:
`Lightning pilot, G1: Planner accepted +0.135`.
**Sound.** Soft pluck per green step; nothing on red.

### S10 The exam: 2:18–2:37 · 3D (`3D-05`, `3D-06`) then MANIM (`Exam`)

**Visual.**
1. (2:18–2:24) Amber rule draws across the frame: `HELD-OUT · levels 5–7 · never seen in training`.
   3D-05 turntable montage, 1.5 s each: `baby_bottle_01` (milk film), `sippy_cup_01` (avocado),
   `gratin_dish_01` (baked cheese, pasta starch), plus the baking-tray turntable (burnt sugar).
2. (2:24–2:28) 3D-06: Baking drill #1 side by side, same seed. Left: G0, four items in the racks,
   eight left on the counter. Right: champion, eleven items in. Labels `G0 28/71` and
   `champion 63/71`.
3. (2:28–2:37) MANIM `Exam`: four paired bar groups in amber outline (Family #0, Baking #1,
   Party #2, Family #3). Bars grow; deltas write above: `−10.2`, `+49.3`, `+22.1`, `+9.9`. The
   Family #0 delta stays red, the others green. Then the mean: two large numbers, `46.0%` and
   `63.7%`, an arrow between them, and `+17.8 pp` writes in below. A tiny footnote fades in at the
   very end: `n = 4 drills, one seed each`.

**VO.**
> Then the exam: / levels it had never seen, / with baby bottles, / baking trays, / and sugar burnt
> on overnight. // Forty-six percent / became sixty-three point seven. // Plus seventeen point eight
> points, / ahead on three drills of four.

**On-screen text.** As above; small `loaded 23 → 35 of 48 · clean-of-loaded 100% → 91%`.
**Sound.** Music drops to a single held chord at the reveal of `63.7%`; nothing else.

### S11 The honest limits: 2:37–2:50 · MANIM (`Limits`)

**Visual.** The exam numbers shrink to the top-left corner. A plain "footnotes" panel draws, like
the bottom of a paper page, and lines write in one at a time: `n = 4 · one-sided sign test, 3 of 4:
p = 5/16 ≈ 0.31`; `a demonstration, not a statistically established effect`;
`Lightning endpoint throttled to ~5 calls/min → switched loader`; `replay bug: a pasta pot blocked
the door; scored as invalid; corrected after the run; champion lineage unaffected`. A small pot
icon sits in front of a door outline for the last line (the one moment of quiet visual wit).

**VO.**
> Four drills is a small exam: / a sign test gives p of about point three one. // A demonstration,
> / not a proof. // Every throttle and bug, / with its fix, / is in the paper.

**On-screen text.** The footnotes above, set like a paper's footer.
**Sound.** Music thins to piano only.

### S12 Outro: 2:50–3:00 · TITLE / UI (`Outro`, `UI-02`)

**Visual.** (2:50–2:54) UI-02: the full Studio (`sparkleteam-final.png`) in a slow pull-back,
token lanes and the live washer visible. (2:54–3:00) Cut to white. Title writes on centre:
`SparkleTeam: Towards Recursive Self Home Improvement`. Beneath, in grey: `Dave Rauchwerk
(@_elevenarms) · Claude (Anthropic)`, then `Crusoe × Cerebral Valley Recursive Agents Hackathon ·
17 Oct 2026`, then `github.com/elevenarms/RSHI`. A last small line: `Thanks: Composo (DishwasherBench),
Crusoe, NVIDIA Nemotron`.

**VO.**
> Open models. / Cheap inference. / A reward you can't argue with. // SparkleTeam: / towards
> recursive self home improvement.

**On-screen text.** As above.
**Sound.** Music resolves on the title; 1 s of room tone; out.

---

## 4. 3D shots for the render agent

All from the benchmark's own three.js web client (`apps/web`), using the run's episode records in
`packages/crew/runs/2026-10-17T20-49-49-evolve/episodes/<episode>/record.json`. Watch mode:
`#<episode>&watch` (silent, embeddable); turntable: `#<episode>&turntable&item=<item id>`.
The water spray is cosmetic (display only) and does not change scores. Render at 1920×1080, 30 fps,
light background, no UI chrome.

| Id | Scene | Source (episode → items, catalogue model, soil) | Camera move | Length |
| --- | --- | --- | --- | --- |
| 3D-01 | S02 | Machine `bosch_smv4hax40g`, empty (any episode before the first placement, e.g. `drill-baking-day-12-s1__crew-G2-704108__s1__7af52537` at event 0). | Three-quarter front, eye height of a standing person. Slow dolly-in 15%, door opens (≈1.5 s), lower rack slides out, then upper rack; hold. | 11 s |
| 3D-02 | S03 | Turntable, episode `drill-mixed-family-12-s3__crew-G0-fc671e__s1__c4ba102f`: `cereal_bowl_01` (`cereal_bowl_vitrelle_159`, yoghurt and muesli, 10 h), then `frying_pan_01` (`frying_pan_clad_254`, `egg_cooked`, 10 h). Soiled state (before the wash). | Locked camera, 15° above, slow turntable spin (≈20°/s); 2.5 s each, crossfade. | 5 s |
| 3D-03 | S03 | Watch replay, episode `drill-breakfast-12-s3__crew-G0-fc671e__s1__ff98085a`: the first placements, e.g. `juice_glass_01` (`tumbler_250`, tomato juice) going mouth-down on the upper rack, `porridge_bowl_04` (`cereal_bowl_vitrelle_159`, porridge), `fork_01`/`spoon_04` into the cutlery basket. Speed up the loading (×4–×8) but show each drop at real speed. | Slow orbit 20° around the open machine, slightly above the upper rack. | 5 s |
| 3D-04 | S03 | Same episode, wash phase with the cosmetic water spray on. | Door-cut-away or semi-transparent door, low angle at the lower spray arm, slow push-in. | 6 s |
| 3D-05 | S10 | Turntables (exam items, soiled): `baby_bottle_01` (`baby_bottle_pp_260`, `milk_film`) from `drill-mixed-family-12-s0__crew-G0-fc671e__s1__aa6870d0`; `sippy_cup_01` (`sippy_cup_240`, `avocado`) from `drill-mixed-family-12-s3__crew-G0-fc671e__s1__c4ba102f`; `gratin_dish_01` (`oven_dish_stoneware_320`, `cheese_baked`, `pasta_starch`) from `drill-dinner-party-12-s2__crew-G0-fc671e__s1__94cd11dc`. Baking tray: `baking_tray_half_sheet` with `burnt_sugar` is not in any exam drill; render it from a baking-day level session or drop it (and change the VO line "baking trays" to "lunch tubs", using `food_container_03`, `food_container_600ml`). | Same turntable framing as 3D-02; 1.5 s each, hard cuts. | 6 s |
| 3D-06 | S10 | Baking drill #1 final loads, same seed, side by side: G0 `drill-baking-day-12-s1__crew-G0-fc671e__s1__0fcdad5a` (loaded: `cake_plate_03`, `curd_pot_02`, `mixing_bowl_01`, `mug_01`; 28/71) vs champion `drill-baking-day-12-s1__crew-G2-704108__s1__7af52537` (all but `mixing_bowl_01`; 63/71). Final state after the wash (clean items as the client draws them). | Identical locked camera for both halves, three-quarter top-down into the open racks; render each separately and composite. | 4 s |

Note: the Studio replay shows representative stills for LIVE and OBJECT because the game servers
had shut down (paper, Fig. 1 caption). The 3D shots above are fresh renders from the episode
records, so label them in the edit as "replay render", not "live".

**UI captures (existing files, `apps/studio/screenshots/`):**
- `UI-01` (S09): `sparkleteam-figure.png`, slow push across the SCORE and TIMELINE panels.
- `UI-02` (S12): `sparkleteam-final.png`, slow pull-back from the token lanes to the whole Studio.
- Spares: `4-exam-live-1512.png`, `3-decision-1512.png` (Gatekeeper verdict), `explore-v3-memory.png`.

---

## 5. Manim scenes and their data

All numbers come from `docs/crew/paper/main.tex` and the run's `report.md`. Do not round
differently from what is listed here.

| Scene | Data |
| --- | --- |
| `Hook` | Illustrative only (flat line, no data). Counter `run 001 → run 100`. |
| `BenchmarkPhysics` | Score = points of clean items / points available. Machine Bosch SMV4HAX40G; Eco 50; one capsule; parameters `anchored-v8.owner-capsule`; 13 MCP tools; threshold from IEC 60436. Dead-spot diagram is schematic. |
| `WeakLoader` | Loader Nemotron-3.5-Super-VL, thinking off; 40-turn cap; G0 practice mean share 39% (Breakfast 56%, Tutorial 44%, Weeknight 32%, Lunch 24%); smoke on Breakfast seed 7: 21%, 3 loaded / 3 clean, 40 turns. |
| `TeamGraph` | Loader · Nemotron-3.5-Super-VL (no thinking); Planner · Nemotron-3.5-Super-VL (low effort); Critic · Nemotron-3-Nano-Omni-Reasoning-30B-A3B (thinking, sees two renders); Coach · Nemotron-3-Super-120B-A12B; Librarian · Nemotron-3-Nano-30B-A3B + code; Gatekeeper · deterministic statistics. All on Crusoe Managed (serverless) Inference. |
| `MemoryLayers` | Three layers: episodic, semantic, procedural. κ formula: p = (s+1)/(n+2), κ = ½ + (p − ½)·n/(n+K), n = s+c, K = 3. Values: 1 support → 0.54, 5/5 → 0.72, 20/20 → 0.90. Top lessons κ = 0.69 ("Tilt glasses mouth-down in the upper rack", "Load cutlery upright in the cutlery basket"). End of run: 36 lessons from 39 episodes. Exam episodes stored apart, never read back. |
| `GenomeEdits` | G0 `G0-fc671e` (no planner, no brief, no preflight, empty playbook). Six ops: `add_rule`, `edit_rule`, `remove_rule`, `set_prompt`, `set_team`, `set_loader`. Playbook ≤ 25 rules. Champion `G2-704108` diff: `+ R1.1` Do not place cereal_bowl_vitrelle_159 on upper_rack/mouth_down_tilted_45; lower_rack on_edge or leave it out. `+ R2.1` Glasses and tumblers: upper_rack, mouth_down. `+ R2.2` Cutlery: cutlery_basket, upright. |
| `Gatekeeper` | 3 paired validation drills per generation (Tutorial, Lunch, Weeknight), same seeds; δ = 0.03; void if fewer than 3 paired. Show G2 bowl rule: incumbent .443, candidate .695, Δ̄ = +0.251, 3 wins 0 losses, ACCEPT; G2 preflight: .443 → .334, Δ̄ = −0.109, REJECT. Variance example: same G0 genome scored 88% on a Tutorial drill and 0% on a Weeknight drill in one evaluation. |
| `Evolution` | G1: Enable Planner .449 → .363 rej.; Memory brief, expanded .449 → .471 rej.* G2: Enable preflight .443 → .334 rej.; Avoid poor bowl placement .443 → .695 acc. G3: Memory brief, focused .618 → .327 rej.; Rules for glasses & cutlery .618 → .775 acc. 2 of 6 accepted. Footnote *: accepted at +0.129 under the corrected replay rule. Levels compare only within a generation (fresh seeds). Lightning pilot G1: Planner accepted +0.135, bowl-mouth-down rule rejected −0.095. |
| `Exam` | Held-out levels 5–7 (mixed family, baking day, dinner party); 4 drills, 12 items each, fast tier. Family #0: 59 avail., G0 48, champion 42, −10.2 pp. Baking #1: 71, 28, 63, +49.3. Party #2: 77, 15, 32, +22.1. Family #3: 71, 31, 38, +9.9. Totals 278 avail., 122 vs 175 (+53 pts). Mean share 46.0% → 63.7%, +17.8 pp; ahead on 3 of 4. Loaded 23 → 35 of 48; clean-of-loaded 100% (23/23) → 91% (32/35). Use amber for every exam element. |
| `Limits` | n = 4, one seed each; one-sided sign test 3 of 4: p = 5/16 ≈ 0.31; "a demonstration, not a statistically established effect"; one machine, programme and detergent; fast tier (agrees with official tier on 91% of the standard load, 97% of pieces on course levels). Lightning throttled to about 5 calls/min. Replay bug: G0 Weeknight 0/87 (pasta pot blocked the door, wash refused) wrongly replayed to 0.322; corrected rule gives incumbent 0.342; champion lineage (G2, G3) unaffected. |
| `Outro` | Title, authors, hackathon, date, repo URL, thanks. Optional cost line: loader 1,481 requests, 38.24M input tokens, 83.7% cached; about 22.7 min of evolution plus about 7 min of exam on 8 game servers. |

---

## 6. Recording guide

Record in a quiet, soft room (a closet full of clothes is ideal), with a cardioid condenser or a
good dynamic mic about 15–20 cm from the mouth, slightly off-axis, with a pop filter, at 48 kHz /
24-bit mono, peaking around −12 dBFS with no processing baked in. Read at about 140 words per
minute: calm, precise and unhurried, like a lab presenting a result it is proud of but will not
oversell. Let the numbers land, and play the dry lines ("you can't sweet-talk physics", "isn't a
model at all", "self home improvement") completely straight; the wit works best undersold. Honour
"/" as a short breath and "//" as a full beat. Record each scene as its own file, with 1 s of
silence at the head and tail and three takes per scene (keep the best, or name the takes
`_t1/_t2/_t3`): `vo_01_hook.wav`, `vo_02_machine.wav`, `vo_03_physics.wav`, `vo_04_loader.wav`,
`vo_05_team.wav`, `vo_06_memory.wav`, `vo_07_genome.wav`, `vo_08_gatekeeper.wav`,
`vo_09_evolution.wav`, `vo_10_exam.wav`, `vo_11_limits.wav`, `vo_12_outro.wav`. Also record 10 s of
room tone (`vo_00_roomtone.wav`). Numbers are read as written in the VO ("sixty-three point seven",
"p of about point three one"); "SMV4HAX40G" is not spoken.
