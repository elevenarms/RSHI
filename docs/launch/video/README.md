# SparkleTeam launch video: render pipeline

Everything needed to rebuild `out/sparkleteam.mp4` (1920×1080, 30 fps, H.264 + AAC) from
sources: Manim scenes for the diagrams, 3D shots captured from DishwasherBench's own three.js
client, the Studio stills, a voice-over and a quiet music bed. The script is `SCRIPT.md`; the
art direction is `../STYLE.md`.

Rendered media (`media/`, `renders/`, `captures/`, `out/`, `vo/*.wav`, `music/*.wav`, model
files) is gitignored. Only sources are committed.

## Layout

| Path | What |
| --- | --- |
| `scenes/style.py` | The visual system (palette, type, helpers: title card, lower third, table, bars, team graph with packets, typed diff, banner, tags, count-up). |
| `scenes/sNN_*.py` | One Manim scene per script scene (class names as in `SCRIPT.md`). `test_scene.py` and `gallery.py` are checks, not part of the cut. |
| `shots/script.json` | The 3D shot list of the script (3D-01 … 3D-06). `shots/sample.json`: one short shot of each kind. |
| `scripts/capture3d.ts` | Captures the 3D shots (see its header for every shot field). |
| `scripts/game-server.ts` | The game server the captures use: port 8899, data `.scratch/video-game`, open mode, course levels plus the crew's drill levels. |
| `scripts/make_vo.py` | Synthesises the VO from `SCRIPT.md` with Kokoro-82M (`bm_george`). |
| `scripts/make_music.py` | Generates the music bed (`music/bed.wav`). |
| `timeline.json` | The edit: scenes in order, their clips, VO files, transitions, captions, tags. |
| `scripts/compose.py` | Assembles the timeline into the MP4, plus the teaser and poster frame. |
| `scripts/build.sh` | Renders out-of-date Manim scenes, then composes. |

## One-time setup (macOS)

```sh
brew install cairo pango pkg-config ffmpeg espeak-ng
brew install --cask font-jetbrains-mono
cd docs/crew/launch/video
uv venv .venv --python 3.12
uv pip install --python .venv/bin/python manim kokoro-onnx soundfile pyloudnorm scipy
# Kokoro model files (Apache-2.0) into models/: kokoro-v1.0.onnx and voices-v1.0.bin
# from the kokoro-onnx GitHub release (model-files-v1.0).
```

No LaTeX: every piece of text is Pango `Text`/`MarkupText` in JetBrains Mono. Check the font is
visible to Pango with `.venv/bin/python -c "import manimpango; print([f for f in manimpango.list_fonts() if 'JetBrains' in f])"`.

## Render

From `docs/crew/launch/video`:

```sh
# 1. 3D shots (builds apps/web, starts its own game server on 8899, stops it afterwards).
#    About 4 minutes for the whole list; the two washed shots run a fast-tier GPU wash each.
(cd ../../../.. && node_modules/.bin/tsx docs/crew/launch/video/scripts/capture3d.ts docs/crew/launch/video/shots/script.json)
#    one shot only:            ... shots/script.json --only 3D-04
#    against a running server: ... shots/script.json --server http://127.0.0.1:8899 --no-build

# 2. Voice-over (or record your own, see below).
.venv/bin/python scripts/make_vo.py --voice bm_george --speed 1.08 --pause-scale 0.75

# 3. Music bed (optional; compose works without it, or pass --no-music).
.venv/bin/python scripts/make_music.py --seconds 240

# 4. Manim scenes + composition.
scripts/build.sh            # → out/sparkleteam.mp4, out/sparkleteam-teaser.mp4, out/sparkleteam-poster.png
scripts/build.sh --force    # re-render every Manim scene
scripts/build.sh --scene Exam   # render one scene only (renders/manim/Exam.mp4)
```

`out/edl.json` lists the start and length of every scene and clip in the final cut.

## Timing rules

- A scene lasts max(its clips, its VO + a breath of 0.25 s). When the VO is longer, the scene's
  stretch clip (`"stretch": true`, else its last clip) holds its last frame: visuals stretch,
  the voice is never sped up. So end every Manim scene on a clean, holdable frame.
- A missing VO file means silence for the scene's natural length.
- Transitions per clip: `"in": "dip"` (8-frame dip to white), `"in": {"xfade": 0.5}`, or a cut.
- The music bed is mixed at `gain_db` and ducked under the VO with a sidechain compressor.

## Add or replace the VO

Put WAVs (any rate, mono or stereo) at the paths `timeline.json` names, e.g.
`vo/vo_05_team.wav`, then run `scripts/build.sh`. Record per `SCRIPT.md` section 6 (48 kHz,
one file per scene, ~1 s of room tone at head and tail is fine). Normalise to about -16 LUFS:
`ffmpeg -i in.wav -af loudnorm=I=-16:TP=-1.5:LRA=11 -ar 48000 vo/vo_05_team.wav`.

## Change a shot

- Manim: edit `scenes/sNN_*.py` (or `style.py`) and rerun `scripts/build.sh`; only changed scenes re-render.
- 3D: edit `shots/script.json` (episode, replayed actions, camera `az`/`el`/`zoom`/`pan`,
  turntable items, wash) and recapture with `--only <id>`. Episodes are replayed from the run's
  records (`packages/crew/runs/2026-10-17T20-49-49-evolve/episodes/*/record.json`); the washed
  baking-drill loads reproduce the recorded scores (G0 28/71, champion 63/71). Every 3D clip is
  tagged "replay render" in the edit.
- Edit: `timeline.json` (order, captions, tags, transitions), then `scripts/build.sh`.

## How the 3D capture works

The client is driven unchanged (no edits to `apps/web`):
- `step` mode replaces the page's `performance.now` and `requestAnimationFrame` with a virtual
  clock advanced exactly 1/fps per frame, so turntables, physics drops, camera moves and the
  cosmetic water are perfectly smooth whatever the capture speed. Actions timed during a shot are
  posted to the HTTP API at their shot time, so drops play at real speed while the loading
  itself is sped up.
- `realtime` mode grabs wall-clock frames and resamples them to the frame rate (choppier;
  rarely needed).
- The orbit, dolly and pan wrap the client's `WatchCamera.update` from the page (display only).
  This relies on the field names `watchCamera`, `toward`, `right`, `up` surviving the Vite build
  (they do: the bundle does not mangle properties).
