# Crew exam report

Held-out tasks (test split, never seen in training): 4, tier fast.

| task | baseline | champion | delta |
|---|---|---|---|
| Family drill #0 (`drill-mixed-family-12-s0`) | 34/59 (58%) | 51/59 (86%) | 29 pp |
| Baking drill #1 (`drill-baking-day-12-s1`) | 20/71 (28%) | 21/71 (30%) | 1 pp |
| Dinner party drill #2 (`drill-dinner-party-12-s2`) | 0/77 (0%) | 63/77 (82%) | 82 pp |
| Family drill #3 (`drill-mixed-family-12-s3`) | 34/71 (48%) | 37/71 (52%) | 4 pp |
| **mean share** | **33.4%** | **62.5%** | **29.1 pp** |

Per-item clean rate of loaded items: baseline 80% (16/20), champion 100% (34/34).

## Genome diff G0-fc671e -> G2-c994c3

- loader.reasoningEffort: "off" -> "5"
- + rule R1.1: Glasses and tumblers: upper_rack, mouth_down stance.
- + rule R1.2: Cutlery (knives, forks, spoons): cutlery_basket, upright stance.

## Champion playbook

- [R1.1] Glasses and tumblers: upper_rack, mouth_down stance.
- [R1.2] Cutlery (knives, forks, spoons): cutlery_basket, upright stance.

## Top lessons in memory

- (0.69) Place items with tomato_sauce on the lower_rack in an on_edge stance.
- (0.46) Do not rely on offering items; ensure dishes with vegetable_oil and spinach_particles are properly loaded.
- (0.46) Pre‑treat yoghurt residues or assign yoghurt bowls to a suitable rack.
- (0.46) Pre‑rinse avocado‑soiled glasses before loading.
- (0.46) Load knives with butter_margarine onto the lower_rack.
- (0.60) Place deep plates with tomato sauce in the lower rack.
- (0.75) Tilt glasses mouth-down in the upper rack.
- (0.79) Load cutlery upright in the cutlery basket.
- (0.54) Load flat items such as spoons on the lower rack.
- (0.60) Place bowls with yoghurt in the lower rack.
- (0.54) limit tilt angle when loading bowls on the upper rack
- (0.54) orient baked dishes mouth-down on the lower rack

## Decisions

- Enable Planner for per-item loading guidance: rejected (mean share -0.086 < margin 0.03 (1 wins, 2 losses on 3 paired tasks))
- Activate Memory Brief with expanded lessons: rejected (mean share +0.021 < margin 0.03 (1 wins, 2 losses on 3 paired tasks))
- Enable preflight check: rejected (mean share -0.109 < margin 0.03 (1 wins, 2 losses on 3 paired tasks))
- Avoid poor‑performing bowl placement: accepted (mean share +0.251 >= margin 0.03 (3 wins, 0 losses on 3 paired tasks))
- Activate memory brief with focused lessons: rejected (mean share -0.291 < margin 0.03 (1 wins, 2 losses on 3 paired tasks))
- Add high‑confidence placement rules for glasses and cutlery: accepted (mean share +0.157 >= margin 0.03 (2 wins, 1 losses on 3 paired tasks))
- Avoid poor‑performing bowl placement: rejected (mean share +0.013 < margin 0.03 (1 wins, 1 losses on 3 paired tasks))
- High‑confidence placement rules for glasses and cutlery: accepted (mean share +0.163 >= margin 0.03 (2 wins, 1 losses on 3 paired tasks))
- Avoid poor‑performing placement of cereal_bowl_vitrelle_159: rejected (mean share -0.024 < margin 0.03 (2 wins, 1 losses on 3 paired tasks))
- Optimal placement for ramekin_porcelain_89: rejected (mean share -0.097 < margin 0.03 (1 wins, 2 losses on 3 paired tasks))
- Add placement rule for problematic cereal bowl: rejected (mean share -0.189 < margin 0.03 (1 wins, 2 losses on 3 paired tasks))
- Increase loader reasoning effort: accepted (mean share +0.059 >= margin 0.03 (2 wins, 1 losses on 3 paired tasks))

## Token usage per model

- nvidia/NVIDIA-Nemotron-3.5-Super-VL: 1484 requests, 38738372 in (32867392 cached), 929048 out, 7 retries
- nvidia/Nemotron-3-Nano-Omni-Reasoning-30B-A3B: 10 requests, 11695 in (0 cached), 39630 out, 0 retries
- nvidia/NVIDIA-Nemotron-3-Super-120B-A12B: 4 requests, 12870 in (2304 cached), 2777 out, 0 retries
