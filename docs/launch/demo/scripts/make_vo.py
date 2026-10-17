"""Synthesise the demo VO blocks of DEMO_SCRIPT.md with Kokoro (bm_george) into vo/A.wav ...
Run with ../video/.venv/bin/python from docs/crew/launch/demo."""
import re, sys, json
from pathlib import Path
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro
HERE = Path(__file__).resolve().parent.parent
M = HERE.parent / "video/models"
SPEED = {"A": 1.2, "B": 1.12, "C": 1.12, "D": 1.25}
k = Kokoro(str(M / "kokoro-v1.0.onnx"), str(M / "voices-v1.0.bin"))
text = (HERE / "DEMO_SCRIPT.md").read_text()
durs = {}; caps = []
for m in re.finditer(r"^## (\w) .*?\nvo: (.+)$", text, re.M):
    key, vo = m.group(1), m.group(2)
    parts = []; t = 0.0
    for sent in re.split(r"(?<=[.:])\s+", vo):
        a, sr = k.create(sent, voice="bm_george", speed=SPEED[key], lang="en-gb")
        nz = np.where(np.abs(a) > 0.004)[0]
        a = a[max(0, nz[0] - 600): nz[-1] + 1200] if len(nz) else a
        caps.append({'block': key, 'start': round(t, 2), 'end': round(t + len(a) / sr, 2), 'text': sent})
        t += len(a) / sr + int(0.16 * sr) / sr
        parts += [a, np.zeros(int(0.16 * sr), dtype=a.dtype)]
    audio = np.concatenate(parts[:-1])
    sf.write(HERE / f"vo/{key}.wav", audio, sr)
    durs[key] = round(len(audio) / sr, 2)
print(json.dumps(durs))
(HERE / "vo/durations.json").write_text(json.dumps(durs))
(HERE / "vo/captions.json").write_text(json.dumps(caps, indent=1))
