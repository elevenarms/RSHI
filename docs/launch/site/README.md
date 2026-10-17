# SparkleTeam launch site

Static project page for *SparkleTeam: Towards Recursive Self Home Improvement*. Plain HTML/CSS and
a few lines of JS; no build step. GitHub Pages can serve this folder as is (not enabled).

```
index.html
assets/css/site.css        visual system (tokens from docs/crew/launch/STYLE.md)
assets/js/site.js          fills placeholders from placeholders.json; BibTeX copy button
assets/placeholders.json   ALL pending values in one place
assets/SparkleTeam-paper.pdf   copy of docs/crew/paper/main.pdf
assets/img/                Studio figure, benchmark stills (compressed JPEG), logos/
```

Preview: `cd docs/crew/launch/site && python3 -m http.server 8930`, then open
http://localhost:8930. (From `file://` the placeholders.json fetch is blocked; placeholders then
just stay visible.)

## Placeholders

Text and link placeholders: set the value in `assets/placeholders.json` (a string replaces
`{{KEY}}` on the page; `null` keeps the amber dashed marker). Every spot is also marked in
`index.html` with `<!-- PLACEHOLDER: ... -->` (grep for `PLACEHOLDER`).

Story and numbers follow docs/crew/launch/REFRAME.md (the honest reframe: the 4-drill +17.8 pp
did not replicate; the headline is learned superstitions).

| Key | Status | Where | Source |
| --- | --- | --- | --- |
| `FINDING_HEADLINE`, `FINDING_N`, `P_CLEAN_DOWN`, `P_CLEAN_UP`, `RESIDUE_DELTA`, `WATER_ML` | filled | Finding 1 block (hollow items mouth up vs down) | INSIGHTS.md "FINDING 1" |
| `EXAM12_DELTA`, `EXAM12_CI`, `EXAM12_WINS` | filled (also hard-coded in the HTML) | "Exam and replication" block | 12-drill replication, REFRAME.md |
| `VIDEO_URL` | filled: `assets/video/sparkleteam.mp4` | Video button, teaser caption | launch video |
| `SLIDES_URL` | filled | Slides button | deck |
| `SFT_DATASET` | **pending** | "Next recursion" box (proposed fine-tune) | docs/crew/insights/sft/README.md (examples, episodes, mean score) once exported |
| `INSIGHTS_ABLATIONS`, `INSIGHTS_TRANSFER`, `INSIGHTS_PHYSICS_MAP` | **pending** | "More from the Division" | INSIGHTS.md (ablation still running) |
| `STUDIO_URL` | **pending** | Studio replay button | hosted replay / recording |

Edited directly in `index.html` (HTML comments mark them):

- `ABSTRACT`: **pending sync.** The paper's revised abstract was not ready; the page carries our
  faithful summary of REFRAME.md. Replace it verbatim from docs/crew/paper/main.tex when it lands.
- `TEASER`: wired to `assets/video/sparkleteam-teaser.mp4` with poster
  `assets/video/sparkleteam-poster.png`; the reframed cut replaces these files under the same names.
- `SITE_URL`: share-card URLs are absolute for https://elevenarms.github.io/RSHI/.

## Logos (official sources, unaltered except as noted)

| Mark | Source | Change |
| --- | --- | --- |
| `assets/img/logos/crusoe.svg` | https://crusoe.ai footer logo: https://cdn.prod.website-files.com/6855c1aa175582ee23e0aa19/68762899486863fd46acd673_logo-footer.svg | fill white → black (monochrome, for a white page) |
| `assets/img/logos/cerebral-valley-mark.svg` | inline header logo on https://cerebralvalley.ai (the mark only; the site has no wordmark file, so "Cerebral Valley" is set as text beside it) | `currentColor` → black, size attributes added |
| `assets/img/logos/nvidia.svg` | https://www.nvidia.com/content/dam/en-zz/Solutions/about-nvidia/nvidia-brochure/images/nvidia-logo-black.svg | none (shown greyscale via CSS, official colours on hover) |

Worth confirming against each brand kit before a public launch (Crusoe colour inversion,
Cerebral Valley mark + text lockup).

## Content sources

All numbers come from docs/crew/paper/main.tex (and main.pdf), docs/crew/README.md and
packages/crew/runs/2026-10-17T20-49-49-evolve/report.md. Benchmark stills are from
apps/web/screenshots, the Studio figure from apps/studio/screenshots/sparkleteam-figure.png.

`screenshots/` holds local verification captures and is gitignored.
