# Crew exam report

Held-out tasks (test split, never seen in training): 12, tier fast.

| task | baseline | champion | delta |
|---|---|---|---|
| Family drill #0 (`drill-mixed-family-12-s0`) | 48/59 (81%) | 48/59 (81%) | 0 pp |
| Baking drill #1 (`drill-baking-day-12-s1`) | 57/71 (80%) | 24/71 (34%) | -46 pp |
| Dinner party drill #2 (`drill-dinner-party-12-s2`) | 22/77 (29%) | 16/77 (21%) | -8 pp |
| Family drill #3 (`drill-mixed-family-12-s3`) | 15/71 (21%) | 47/71 (66%) | 45 pp |
| Baking drill #4 (`drill-baking-day-12-s4`) | 5/68 (7%) | 27/68 (40%) | 32 pp |
| Dinner party drill #5 (`drill-dinner-party-12-s5`) | 4/73 (5%) | 8/73 (11%) | 5 pp |
| Family drill #6 (`drill-mixed-family-12-s6`) | 30/66 (45%) | 20/66 (30%) | -15 pp |
| Baking drill #7 (`drill-baking-day-12-s7`) | 18/93 (19%) | 24/93 (26%) | 6 pp |
| Dinner party drill #8 (`drill-dinner-party-12-s8`) | 40/61 (66%) | 49/61 (80%) | 15 pp |
| Family drill #9 (`drill-mixed-family-12-s9`) | 69/69 (100%) | 57/69 (83%) | -17 pp |
| Baking drill #10 (`drill-baking-day-12-s10`) | 36/69 (52%) | 46/69 (67%) | 14 pp |
| Dinner party drill #11 (`drill-dinner-party-12-s11`) | 53/74 (72%) | 50/74 (68%) | -4 pp |
| **mean share** | **48.2%** | **50.5%** | **2.3 pp** |

Per-item clean rate of loaded items: baseline 94% (68/72), champion 97% (83/86).

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

- nvidia/NVIDIA-Nemotron-3.5-Super-VL: 937 requests, 24337901 in (19325056 cached), 447108 out, 2 retries
