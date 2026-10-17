"""Voice-over for the SparkleTeam launch video, synthesised locally with Kokoro-82M (ONNX).

Reads the VO blockquotes of SCRIPT.md section 3 (one per `### S<NN> ...` scene), splits them on
"//" (a held beat, 600 ms) and "/" (a short pause, 250 ms), synthesises each chunk, joins them
with silence, adds 0.3 s of head and 0.5 s of tail, normalises to -16 LUFS and writes
vo/vo_<NN>_<name>.wav (48 kHz mono, 24-bit) plus vo/durations.json.

    .venv/bin/python scripts/make_vo.py [--voice bm_george] [--speed 0.95] [--only 03,10]

Model files (gitignored) in models/: kokoro-v1.0.onnx and voices-v1.0.bin from
https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0 (Kokoro-82M,
Apache-2.0, hexgrad). Needs espeak-ng (brew install espeak-ng).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np
import pyloudnorm
import soundfile as sf
from scipy.signal import resample_poly

HERE = Path(__file__).resolve().parent.parent
NAMES = {
    "01": "hook", "02": "machine", "03": "physics", "04": "loader", "05": "team", "06": "memory",
    "07": "genome", "08": "gatekeeper", "09": "evolution", "10": "exam", "10b": "finding1", "11": "limits", "12": "outro",
}
PAUSE_SHORT, PAUSE_LONG, HEAD, TAIL = 0.25, 0.60, 0.30, 0.50
OUT_SR = 48000
TARGET_LUFS = -16.0

# Spoken forms: what the synthesiser should say for what the script writes.
SAY = [
    (r"\bNemotron 3\.5 Super VL\b", "Nemotron three point five Super V L"),
    (r"\bVL\b", "V L"),
    (r"\bGPU\b", "G P U"),
    (r"\bLUFS\b", "L U F S"),
    (r"\bpp\b", "points"),
    (r"≈", "about"),
    (r"\bDishwasherBench\b", "Dishwasher Bench"),
    (r"\bSparkleTeam\b", "Sparkle Team"),
    (r"—|–", ", "),
]


def vo_blocks(script: Path) -> dict[str, str]:
    text = script.read_text()
    section = text.split("## 3. Shot table", 1)[1].split("\n## 4.", 1)[0]
    out: dict[str, str] = {}
    for block in re.split(r"\n(?=### S\d\d[a-z]? )", section):
        m = re.match(r"### S(\d\d[a-z]?) ", block)
        if not m:
            continue
        lines = []
        vo = block.split("**VO.**", 1)
        if len(vo) < 2:
            continue
        for line in vo[1].splitlines()[1:]:
            if line.startswith(">"):
                lines.append(line[1:].strip())
            elif lines and line.strip() == "":
                break
        out[m.group(1)] = " ".join(lines)
    return out


def chunks(vo: str) -> list[tuple[str, float]]:
    """[(text, pause after)]: '//' a held beat, '/' a short pause."""
    parts = re.split(r"(//|/)", vo)
    out: list[tuple[str, float]] = []
    for i in range(0, len(parts), 2):
        t = parts[i].strip()
        sep = parts[i + 1] if i + 1 < len(parts) else ""
        pause = PAUSE_LONG if sep == "//" else PAUSE_SHORT if sep == "/" else 0.0
        if t:
            out.append((t, pause))
        elif out and pause:
            text, p = out[-1]
            out[-1] = (text, max(p, pause))
    return out


def spoken(text: str) -> str:
    for pattern, repl in SAY:
        text = re.sub(pattern, repl, text)
    return text


def trim(a: np.ndarray, sr: int, thresh: float = 0.004) -> np.ndarray:
    """Trims the synthesiser's own leading/trailing near-silence (keeps 40 ms)."""
    idx = np.where(np.abs(a) > thresh)[0]
    if idx.size == 0:
        return a
    pad = int(0.04 * sr)
    return a[max(idx[0] - pad, 0): min(idx[-1] + pad, len(a))]


def loudnorm(src: Path, dst: Path) -> None:
    """Two-pass EBU R128 loudnorm to TARGET_LUFS with a -1.5 dBTP ceiling (ffmpeg)."""
    import subprocess

    f = f"loudnorm=I={TARGET_LUFS}:TP=-1.5:LRA=11"
    first = subprocess.run(
        ["ffmpeg", "-hide_banner", "-nostats", "-i", str(src), "-af", f + ":print_format=json", "-f", "null", "-"],
        capture_output=True, text=True, check=True,
    ).stderr
    m = json.loads(first[first.rindex("{"): first.rindex("}") + 1])
    second = (
        f"{f}:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
        f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
    )
    subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-af", second,
         "-ar", str(OUT_SR), "-ac", "1", "-c:a", "pcm_s24le", str(dst)],
        check=True,
    )


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", default="bm_george")
    ap.add_argument("--speed", type=float, default=0.95)
    ap.add_argument("--only", default="")
    ap.add_argument("--pause-scale", type=float, default=1.0, help="scales the / and // pauses")
    ap.add_argument("--script", default=str(HERE / "SCRIPT.md"))
    args = ap.parse_args()
    global PAUSE_SHORT, PAUSE_LONG
    PAUSE_SHORT, PAUSE_LONG = PAUSE_SHORT * args.pause_scale, PAUSE_LONG * args.pause_scale
    from kokoro_onnx import Kokoro

    kokoro = Kokoro(str(HERE / "models/kokoro-v1.0.onnx"), str(HERE / "models/voices-v1.0.bin"))
    lang = "en-gb" if args.voice.startswith("b") else "en-us"
    blocks = vo_blocks(Path(args.script))
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    vo_dir = HERE / "vo"
    vo_dir.mkdir(exist_ok=True)
    dur_file = vo_dir / "durations.json"
    durations = json.loads(dur_file.read_text()) if dur_file.exists() else {}
    meter = pyloudnorm.Meter(OUT_SR)
    for num, name in NAMES.items():
        if only and num not in only:
            continue
        if num not in blocks:
            print(f"S{num}: no VO in the script", file=sys.stderr)
            continue
        pieces: list[np.ndarray] = [np.zeros(int(HEAD * OUT_SR))]
        for text, pause in chunks(blocks[num]):
            audio, sr = kokoro.create(spoken(text), voice=args.voice, speed=args.speed, lang=lang)
            audio = trim(np.asarray(audio, dtype=np.float64), sr)
            if audio.size < sr * 0.1:
                raise RuntimeError(f"S{num}: empty chunk for {text!r}")
            audio = resample_poly(audio, OUT_SR, sr)
            pieces += [audio, np.zeros(int(pause * OUT_SR))]
        pieces.append(np.zeros(int(TAIL * OUT_SR)))
        wav = np.concatenate(pieces)
        path = vo_dir / f"vo_{num}_{name}.wav"
        raw = vo_dir / f".raw_{num}.wav"
        sf.write(raw, (wav / max(float(np.abs(wav).max()), 1e-9) * 0.5).astype(np.float32), OUT_SR, subtype="FLOAT")
        loudnorm(raw, path)
        raw.unlink()
        wav, _ = sf.read(path)
        peak = float(np.abs(wav).max())
        durations[num] = round(len(wav) / OUT_SR, 3)
        lufs = meter.integrated_loudness(wav)
        print(f"S{num} {path.name}: {durations[num]:.2f} s, {lufs:.1f} LUFS, peak {20*np.log10(max(peak,1e-9)):.1f} dBFS")
    durations["voice"] = f"kokoro-82m {args.voice} speed {args.speed}"
    durations["total"] = round(sum(v for k, v in durations.items() if k[:2].isdigit()), 3)
    dur_file.write_text(json.dumps(durations, indent=2) + "\n")
    print("total", durations["total"], "s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
