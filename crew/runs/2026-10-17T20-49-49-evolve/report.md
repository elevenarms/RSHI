# Crew exam report

Held-out tasks (test split, never seen in training): 4, tier fast.

| task | baseline | champion | delta |
|---|---|---|---|
| Family drill #0 (`drill-mixed-family-12-s0`) | 48/59 (81%) | 42/59 (71%) | -10 pp |
| Baking drill #1 (`drill-baking-day-12-s1`) | 28/71 (39%) | 63/71 (89%) | 49 pp |
| Dinner party drill #2 (`drill-dinner-party-12-s2`) | 15/77 (19%) | 32/77 (42%) | 22 pp |
| Family drill #3 (`drill-mixed-family-12-s3`) | 31/71 (44%) | 38/71 (54%) | 10 pp |
| **mean share** | **46.0%** | **63.7%** | **17.8 pp** |

Per-item clean rate of loaded items: baseline 100% (23/23), champion 91% (32/35).

## Genome diff G0-fc671e -> G2-704108

- + rule R1.1: Do not place cereal_bowl_vitrelle_159 on upper_rack/mouth_down_tilted_45; instead put it on lower_rack on_edge or leave it out if unstable.
- + rule R2.1: Glasses and tumblers: upper_rack, mouth_down (or slight forward tilt).
- + rule R2.2: Cutlery (forks, knives, spoons): cutlery_basket, upright.

## Champion playbook

- [R1.1] Do not place cereal_bowl_vitrelle_159 on upper_rack/mouth_down_tilted_45; instead put it on lower_rack on_edge or leave it out if unstable.
- [R2.1] Glasses and tumblers: upper_rack, mouth_down (or slight forward tilt).
- [R2.2] Cutlery (forks, knives, spoons): cutlery_basket, upright.

## Top lessons in memory

- (0.65) Place items with tomato_sauce on the lower_rack in an on_edge stance.
- (0.46) Do not rely on offering items; ensure dishes with vegetable_oil and spinach_particles are properly loaded.
- (0.46) Pre‑treat yoghurt residues or assign yoghurt bowls to a suitable rack.
- (0.46) Pre‑rinse avocado‑soiled glasses before loading.
- (0.46) Load knives with butter_margarine onto the lower_rack.
- (0.60) Place deep plates with tomato sauce in the lower rack.
- (0.69) Tilt glasses mouth-down in the upper rack.
- (0.69) Load cutlery upright in the cutlery basket.
- (0.54) Load flat items such as spoons on the lower rack.
- (0.54) Place bowls with yoghurt in the lower rack.
- (0.54) limit tilt angle when loading bowls on the upper rack
- (0.54) orient baked dishes mouth-down on the lower rack

## Decisions

- Enable Planner for per-item loading guidance: rejected (mean share -0.086 < margin 0.03 (1 wins, 2 losses on 3 paired tasks))
- Activate Memory Brief with expanded lessons: rejected (mean share +0.021 < margin 0.03 (1 wins, 2 losses on 3 paired tasks))
- Enable preflight check: rejected (mean share -0.109 < margin 0.03 (1 wins, 2 losses on 3 paired tasks))
- Avoid poor‑performing bowl placement: accepted (mean share +0.251 >= margin 0.03 (3 wins, 0 losses on 3 paired tasks))
- Activate memory brief with focused lessons: rejected (mean share -0.291 < margin 0.03 (1 wins, 2 losses on 3 paired tasks))
- Add high‑confidence placement rules for glasses and cutlery: accepted (mean share +0.157 >= margin 0.03 (2 wins, 1 losses on 3 paired tasks))

## Token usage per model

- nvidia/NVIDIA-Nemotron-3.5-Super-VL: 1481 requests, 38236520 in (32016576 cached), 430313 out, 2 retries
- nvidia/Nemotron-3-Nano-Omni-Reasoning-30B-A3B: 11 requests, 12820 in (0 cached), 56432 out, 0 retries
- nvidia/NVIDIA-Nemotron-3-Super-120B-A12B: 3 requests, 8688 in (0 cached), 2004 out, 1 retries
- nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B: 7 requests, 7771 in (0 cached), 3476 out, 0 retries
