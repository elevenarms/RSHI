# SparkleTeam one-minute demo video

`out/sparkleteam-demo-60s.mp4` (1920×1080, 30 fps, H.264 + AAC, 59.8 s) and
`out/sparkleteam-demo-poster.png`; copies in `../site/assets/video/sparkleteam-demo.{mp4,-poster.png}`.
Media (`media/`, `out/`, `vo/*.wav`) is gitignored; only scripts, the VO script and this README are committed.

Every moving picture is a screen recording of the real tool, captured with CDP `Page.startScreencast`
from headed Chrome (the 3D needs the GPU):

| Source | What |
| --- | --- |
| `media/studio.mp4` | The Studio during a live `crew evolve` generation (run `2026-10-17T22-24-43-evolve`, port 8796, Super-VL loader, real Crusoe calls; the Gatekeeper rejected its proposal, −10.4). Page zoom 0.79 so the full Studio fits 1920×1022. |
| `media/watch.mp4` | The game's watch page for one episode of that run: the loader placing items, then the wash with the water FX. |
| `media/replay.mp4` | The Studio replaying the real evolution run `2026-10-17T20-49-49-evolve` at ×8 (`?replay=…&speed=8&t=553`): critic lessons, coach proposals, the ACCEPTED verdict (+25.1). Tagged "STUDIO REPLAY OF A REAL RUN" in the cut. |
| `media/code/*.png` | Our source files, syntax-highlighted (Pygments) and rendered in Chrome. |

## Rebuild

```sh
# 1. a live run (fresh port, memory and game dirs), then record it
CREW_PORT=8796 CREW_MEMORY_DIR=.crew/memory-demo-<t> CREW_GAME_DIR=.crew/game-demo-<t> \
CREW_MODEL_LOADER=nvidia/NVIDIA-Nemotron-3.5-Super-VL CREW_LOADER_EFFORT=off CREW_RPM=250 \
CREW_MAX_TURNS=40 CREW_DRILL_ITEMS=12 CREW_GAME_SHARDS=4 \
pnpm --filter @spotless/crew crew evolve --resume --generations 1 --practice 2 --validate 2 --proposals 1 --concurrency 4 --tier fast
ZOOM=0.79 node scripts/record.mjs http://127.0.0.1:8796/ media/studio 900   # touch media/studio/STOP to end
ZOOM=1 node scripts/record.mjs "<watch url from the run log>" media/watch 400
scripts/tovideo.sh media/studio media/studio.mp4   # likewise watch, replay
# 2. stills, VO, edit (from the repo root / this folder)
node docs/crew/launch/demo/scripts/codeshots.mjs docs/crew/launch/demo/media/code
../video/.venv/bin/python scripts/make_vo.py        # Kokoro bm_george → vo/*.wav + captions.json
node docs/crew/launch/demo/scripts/cards.mjs docs/crew/launch/demo/media/cards
python3 scripts/compose.py                          # → out/sparkleteam-demo-60s.mp4
```

The edit (segment list, speeds, overlays, VO offsets) is the `SEGS` table in `scripts/compose.py`.
Sped-up shots carry a corner tag with the factor; captions are burnt in from `vo/captions.json`.
