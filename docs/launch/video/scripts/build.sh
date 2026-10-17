#!/usr/bin/env bash
# Builds the launch video: renders the manim scenes the timeline uses (only when a scene file or
# style.py is newer than its render), then composes clips + VO + music into out/sparkleteam.mp4
# (plus out/sparkleteam-teaser.mp4 and out/sparkleteam-poster.png).
#
#   scripts/build.sh                 everything that is out of date, then compose
#   scripts/build.sh --scene Hook    render one manim class (any scenes/*.py) and stop
#   scripts/build.sh --force         re-render every manim scene
#   scripts/build.sh --no-music      compose without the music bed
#   scripts/build.sh --capture       also (re)capture the 3D shots of shots/script.json first
set -euo pipefail
cd "$(dirname "$0")/.."
VIDEO="$(pwd)"
ROOT="$(cd ../../../.. && pwd)"
PY="$VIDEO/.venv/bin/python"
MANIM="$VIDEO/.venv/bin/manim"
FORCE=0; ONLY=""; CAPTURE=0; PASS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --force) FORCE=1 ;;
    --scene) ONLY="$2"; shift ;;
    --capture) CAPTURE=1 ;;
    *) PASS+=("$1") ;;
  esac
  shift
done
mkdir -p renders/manim out

render() { # <class>
  local cls="$1" file
  file=$(grep -l "^class $cls(" scenes/*.py | head -1 || true)
  [[ -z "$file" ]] && { echo "no scene defines class $cls" >&2; return 1; }
  local out="renders/manim/$cls.mp4"
  if [[ $FORCE -eq 0 && -f "$out" && "$out" -nt "$file" && "$out" -nt scenes/style.py ]]; then
    echo "  $cls: up to date"; return 0
  fi
  echo "  $cls: rendering ($file)"
  (cd scenes && "$MANIM" -qh --fps 30 --media_dir ../media --disable_caching -v WARNING "$(basename "$file")" "$cls" >/dev/null)
  cp "media/videos/$(basename "$file" .py)/1080p30/$cls.mp4" "$out"
}

if [[ -n "$ONLY" ]]; then render "$ONLY"; exit 0; fi

if [[ $CAPTURE -eq 1 ]]; then
  (cd "$ROOT" && node_modules/.bin/tsx "$VIDEO/scripts/capture3d.ts" "$VIDEO/shots/script.json")
fi

echo "manim scenes:"
for cls in $("$PY" -c "import json;print(' '.join(c['class'] for s in json.load(open('timeline.json'))['scenes'] for c in s['clips'] if c['type']=='manim'))"); do
  render "$cls"
done
echo "compose:"
"$PY" scripts/compose.py timeline.json "${PASS[@]+"${PASS[@]}"}"
ffprobe -v error -show_entries format=duration:stream=codec_type,width,height,r_frame_rate -of compact out/sparkleteam.mp4
