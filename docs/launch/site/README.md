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

| Key | Where | Source |
| --- | --- | --- |
| `FINDING_HEADLINE`, `FINDING_N`, `P_CLEAN_DOWN`, `P_CLEAN_UP`, `RESIDUE_DELTA`, `WATER_ML` | Finding 1 block (bowls mouth-up vs mouth-down) | docs/crew/insights/INSIGHTS.md "FINDING 1" |
| `EXAM12_DELTA`, `EXAM12_CI`, `EXAM12_WINS` | Results, "Robustness: the 12-drill exam" | the 12-drill exam run |
| `INSIGHTS_ABLATIONS`, `INSIGHTS_TRANSFER`, `INSIGHTS_PHYSICS_MAP` | "More from the Division" | INSIGHTS.md |
| `VIDEO_URL` | Video button | the launch video |
| `SLIDES_URL` | Slides button (defaults to `assets/SparkleTeam-deck.pdf`; copy the deck from docs/crew/launch/deck/ into assets/) | deck |
| `STUDIO_URL` | Studio replay button | hosted replay / recording |

Edited directly in `index.html` (HTML comments mark them):

- `TEASER_VIDEO`: the 16:9 teaser box; swap the poster `<img>` and overlay for the `<video>` or
  YouTube `<iframe>` given in the comment.
- `SITE_URL`: Open Graph / Twitter images need absolute URLs. Once the Pages URL is known, make
  `og:image` / `twitter:image` absolute and fill `og:url`.

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
