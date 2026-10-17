# Crew exam report

Held-out tasks (test split, never seen in training): 12, tier fast.

| task | baseline | champion | delta |
|---|---|---|---|
| Family drill #0 (`drill-mixed-family-12-s0`) | 51/59 (86%) | 48/59 (81%) | -5 pp |
| Baking drill #1 (`drill-baking-day-12-s1`) | 63/71 (89%) | 42/71 (59%) | -30 pp |
| Dinner party drill #2 (`drill-dinner-party-12-s2`) | 18/77 (23%) | 32/77 (42%) | 18 pp |
| Family drill #3 (`drill-mixed-family-12-s3`) | 32/71 (45%) | 21/71 (30%) | -15 pp |
| Baking drill #4 (`drill-baking-day-12-s4`) | 0/68 (0%) | 0/68 (0%) | 0 pp |
| Dinner party drill #5 (`drill-dinner-party-12-s5`) | 14/73 (19%) | 33/73 (45%) | 26 pp |
| Family drill #6 (`drill-mixed-family-12-s6`) | 0/66 (0%) | 38/66 (58%) | 58 pp |
| Baking drill #7 (`drill-baking-day-12-s7`) | 0/93 (0%) | 18/93 (19%) | 19 pp |
| Dinner party drill #8 (`drill-dinner-party-12-s8`) | 39/61 (64%) | 0/61 (0%) | -64 pp |
| Family drill #9 (`drill-mixed-family-12-s9`) | 60/69 (87%) | 66/69 (96%) | 9 pp |
| Baking drill #10 (`drill-baking-day-12-s10`) | 46/69 (67%) | 57/69 (83%) | 16 pp |
| Dinner party drill #11 (`drill-dinner-party-12-s11`) | 52/74 (70%) | 0/74 (0%) | -70 pp |
| **mean share** | **45.9%** | **42.7%** | **-3.2 pp** |

Per-item clean rate of loaded items: baseline 98% (65/66), champion 100% (64/64).

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

- nvidia/NVIDIA-Nemotron-3.5-Super-VL: 891 requests, 22792303 in (18996480 cached), 376632 out, 0 retries
