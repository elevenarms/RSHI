# Crew exam report

Held-out tasks (test split, never seen in training): 4, tier fast.

| task | baseline | champion | delta |
|---|---|---|---|
| Family drill #0 (`drill-mixed-family-12-s0`) | 30/59 (51%) | 53/59 (90%) | 39 pp |
| Baking drill #1 (`drill-baking-day-12-s1`) | 54/71 (76%) | 54/71 (76%) | 0 pp |
| Dinner party drill #2 (`drill-dinner-party-12-s2`) | 0/77 (0%) | 8/77 (10%) | 10 pp |
| Family drill #3 (`drill-mixed-family-12-s3`) | 40/71 (56%) | 25/71 (35%) | -21 pp |
| **mean share** | **45.8%** | **52.9%** | **7.1 pp** |

Per-item clean rate of loaded items: baseline 92% (24/26), champion 100% (28/28).

## Genome diff G0-fc671e -> G3-c8f515

- team.usePlanner: false -> true
- team.useMemoryBrief: false -> true
- team.preflightCheck: false -> true
- team.briefLessons: 8 -> 10
- loader.reasoningEffort: "off" -> "20"

## Champion playbook


## Top lessons in memory

- (0.50) Place sauce‑covered plates on the lower rack.
- (0.69) Position glasses mouth‑down (tilted) in the upper rack.
- (0.65) Keep cutlery upright in the cutlery basket.
- (0.54) Make sure all items are loaded into a rack; do not leave items out.
- (0.54) Place plates and knives on the lower rack with flat or edge stance to remove sauce and fat residues.
- (0.60) Put glasses in the upper rack with mouth-down orientation to clean avocado residue.
- (0.46) Load items with mixed oil and solid particles on the lower rack; they will clean without pre‑rinse.
- (0.46) Yoghurt bowls should be placed on the lower rack with a flat stance to avoid residue.
- (0.60) Load cutlery upright in the basket to ensure it is cleaned
- (0.54) Prioritize loading high-point dishes before low-point items to maximize score
- (0.54) Limit total actions per turn to stay within the turn limit
- (0.46) Do not assume items will be cleaned if they remain unloaded

## Decisions

- Enable planner, memory brief, and preflight check: accepted (mean share +0.083 >= margin 0.03 (2 wins, 1 losses on 3 paired tasks))
- Add concrete placement rules derived from high‑confidence lessons: rejected (mean share -0.048 < margin 0.03 (1 wins, 1 losses on 3 paired tasks))
- Add concrete placement rules for bowls and plates: accepted (mean share +0.040 >= margin 0.03 (2 wins, 1 losses on 3 paired tasks))
- Increase memory brief to surface more lessons: accepted (mean share +0.248 >= margin 0.03 (3 wins, 0 losses on 3 paired tasks))
- Add concrete placement rules for bowls and saucepans: accepted (mean share +0.093 >= margin 0.03 (2 wins, 1 losses on 3 paired tasks))
- Give the loader a modest reasoning budget: accepted (mean share +0.267 >= margin 0.03 (3 wins, 0 losses on 3 paired tasks))

## Token usage per model

- nvidia/Nemotron-3-Nano-Omni-Reasoning-30B-A3B: 4 requests, 5045 in (0 cached), 12129 out, 0 retries
- nvidia/NVIDIA-Nemotron-3-Super-120B-A12B: 1 requests, 2886 in (0 cached), 693 out, 0 retries
- nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B: 16 requests, 23180 in (0 cached), 8086 out, 13 retries
- nvidia/NVIDIA-Nemotron-3.5-Super-VL: 658 requests, 16680295 in (14596608 cached), 768716 out, 1 retries
