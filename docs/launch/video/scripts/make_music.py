"""A quiet music bed: slow sustained chords (soft additive pad, no percussion), 84 bpm feel,
one chord per two bars. Deliberately sparse; mixed far under the VO by compose.py.

    .venv/bin/python scripts/make_music.py [--seconds 240] [--out music/bed.wav]
"""

import sys
from pathlib import Path

import numpy as np
import soundfile as sf

SR = 48000
args = sys.argv[1:]
seconds = float(args[args.index("--seconds") + 1]) if "--seconds" in args else 240.0
out = Path(__file__).resolve().parent.parent / (args[args.index("--out") + 1] if "--out" in args else "music/bed.wav")
out.parent.mkdir(parents=True, exist_ok=True)

def hz(m: int) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)

# A minor-ish, open voicings (MIDI): Am(add9) - Fmaj7 - C(add9) - G6/B
CHORDS = [[45, 52, 59, 60, 64], [41, 48, 55, 57, 64], [48, 55, 62, 64, 67], [47, 55, 59, 62, 64]]
bar = 60 / 84 * 4
chord_len = 2 * bar
n = int(seconds * SR)
t = np.arange(n) / SR
mix = np.zeros(n)
rng = np.random.default_rng(7)
k = 0
start = 0.0
while start < seconds:
    notes = CHORDS[k % len(CHORDS)]
    a0, a1 = int(start * SR), min(int((start + chord_len + 2.5) * SR), n)
    tt = t[a0:a1] - start
    L = tt[-1] if len(tt) else 1
    env = np.minimum(1, tt / 1.8) * np.clip((L - tt) / 2.5, 0, 1)  # slow attack, long release
    for i, m in enumerate(notes):
        f = hz(m)
        for det in (-0.12, 0.12):  # gentle chorus
            ph = rng.uniform(0, 2 * np.pi)
            # Soft timbre: fundamental plus quiet 2nd and 3rd partials.
            w = 2 * np.pi * f * (1 + det / 100) * tt + ph
            v = np.sin(w) + 0.18 * np.sin(2 * w) + 0.05 * np.sin(3 * w)
            mix[a0:a1] += env * v * (0.9 if i == 0 else 0.55) * (1 + 0.08 * np.sin(2 * np.pi * 0.11 * tt + i))
    start += chord_len
    k += 1
# A touch of air: very quiet filtered noise, then a simple one-pole low-pass on everything.
mix += 0.01 * np.convolve(rng.standard_normal(n), np.ones(200) / 200, mode="same")
y = np.zeros_like(mix)
a = np.exp(-2 * np.pi * 1800 / SR)
acc = 0.0
for i in range(0, n, 1):
    acc = (1 - a) * mix[i] + a * acc
    y[i] = acc
y /= np.max(np.abs(y)) + 1e-9
y *= 0.5
fade = int(4 * SR)
y[:fade] *= np.linspace(0, 1, fade)
y[-fade:] *= np.linspace(1, 0, fade)
sf.write(out, y.astype(np.float32), SR, subtype="PCM_24")
print(f"→ {out} ({seconds:.0f} s)")
