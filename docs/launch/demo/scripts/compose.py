"""Assemble the 60 s demo from the real recordings (media/*.mp4), code shots, cards, overlays and VO.
usage: python3 scripts/compose.py   (from docs/crew/launch/demo; needs ffmpeg)"""
import json, subprocess
from pathlib import Path
H = Path(__file__).resolve().parent.parent
M, C, O = H / "media", H / "media/cards", H / "out"
O.mkdir(exist_ok=True); (M / "seg").mkdir(exist_ok=True)
FPS = 30
# (kind, source, src_start, out_dur, speed, crop, tag, lower-third index or None)
SEGS = [
    ("png", "card-title", 0, 5.5, 1, None, None, None),
    ("vid", "studio", 2, 3.5, 4, None, "live4", 0),
    ("vid", "watch", 2, 5.5, 4, None, "live4", 1),
    ("vid", "studio", 118, 4.0, 1, "1280:681:0:341", "live1", 2),
    ("vid", "replay", 40.5, 3.0, 1, None, "replay8", 3),
    ("vid", "replay", 44.0, 3.5, 1, None, "replay8", 4),
    ("vid", "replay", 34.5, 4.5, 1, None, "replay8", 5),
    ("vid", "studio", 374, 4.0, 2, None, "live2", 5),
    ("vid", "watch", 104, 5.0, 4, None, "live4", 6),
    ("png", "code:contracts", 0, 1.15, 1, None, "code", None),
    ("png", "code:genome", 0, 1.15, 1, None, "code", None),
    ("png", "code:gatekeeper", 0, 1.15, 1, None, "code", None),
    ("png", "code:crusoe", 0, 1.15, 1, None, "code", None),
    ("png", "code:water", 0, 1.2, 1, None, "code", None),
    ("png", "card-f1", 0, 5.9, 1, None, None, None),
    ("png", "card-sup", 0, 3.1, 1, None, None, None),
    ("png", "card-null", 0, 2.7, 1, None, None, None),
    ("png", "card-next", 0, 2.4, 1, None, None, None),
    ("png", "card-links", 0, 1.4, 1, None, None, None),
]
# Which VO block each segment belongs to; "L" = the links card (no VO).
BLOCK = ["A"] + ["B"] * 8 + ["C"] * 5 + ["D"] * 4 + ["L"]
assert len(BLOCK) == len(SEGS)
MAX_TOTAL = 59.7
import os
HUMAN = Path(os.environ.get("VO_HUMAN_DIR", H / "vo-human"))
import re
import numpy as np, soundfile as sf

def speech_span(path):
    """(duration, first, last) of the audible part of a WAV: 20 ms RMS above the noise floor + 10 dB."""
    a, sr = sf.read(str(path), always_2d=True)
    a = a.mean(axis=1); w = int(0.02 * sr); n = len(a) // w
    db = 20 * np.log10(np.sqrt((a[: n * w].reshape(n, w) ** 2).mean(axis=1)) + 1e-9)
    idx = np.where(db > np.percentile(db, 10) + 10)[0]
    d = len(a) / sr
    return (d, idx[0] * 0.02, min(d, (idx[-1] + 1) * 0.02)) if len(idx) else (d, 0.0, d)

def human_texts():
    """Sentences per block from VO_RECORDING_SCRIPT.md (D: main and short variants)."""
    t = (H / "VO_RECORDING_SCRIPT.md").read_text()
    out = {}
    for m in re.finditer(r"^## (\w) ·.*?\n\n((?:> .*\n)+)", t, re.M):
        out[m.group(1)] = " ".join(l[2:].strip() for l in m.group(2).splitlines())
    short = re.search(r"shorter version:\s*\n\n((?:> .*\n)+)", t)
    if short: out["D-short"] = " ".join(l[2:].strip() for l in short.group(1).splitlines())
    return out

def split_sents(text):
    parts = [p.strip() for p in re.split(r"\s*/\s*|(?<=[.:])\s+", text) if p.strip()]
    out = []
    for p in parts:  # fold very short pieces ("Next:") into the following one
        if out and len(out[-1]) < 8: out[-1] = out[-1] + " " + p
        else: out.append(p)
    return out

ai_caps = json.loads((H / "vo/captions.json").read_text())
texts = human_texts() if (H / "VO_RECORDING_SCRIPT.md").exists() else {}
VOCLIP, CAPREL, VOLEN = {}, {}, {}
for k in "ABCD":
    hp = HUMAN / f"{k}.wav"
    if hp.exists():
        # tighten the recording's padding to PAD s each end (trim only, never stretch)
        PAD = 0.18
        _, a0, b0 = speech_span(hp)
        (M / "vo-trim").mkdir(exist_ok=True)
        tp = M / f"vo-trim/{k}.wav"
        au, sr = sf.read(str(hp), always_2d=True)
        sf.write(str(tp), au[int(max(0, a0 - PAD) * sr): int(min(len(au) / sr, b0 + PAD) * sr)], sr)
        hp = tp
        d, a, b = speech_span(hp)
        txt = texts.get(k, "")
        if k == "D" and "D-short" in texts:  # pick the variant whose length fits the speech best (~14 chars/s)
            txt = min((texts["D"], texts["D-short"]), key=lambda t: abs(len(t) / 14.0 - (b - a)))
        sents = split_sents(txt); tot = sum(len(x) for x in sents) or 1; t = a; caps = []
        for x in sents:
            dt = (b - a) * len(x) / tot
            caps.append({"start": t, "end": t + dt, "text": x}); t += dt
        VOCLIP[k], VOLEN[k], CAPREL[k] = hp, d, caps
        print(f"VO {k}: human {d:.2f} s")
    else:
        VOCLIP[k] = H / f"vo/{k}.wav"; VOLEN[k] = speech_span(VOCLIP[k])[0]
        CAPREL[k] = [{"start": c["start"], "end": c["end"], "text": c["text"]} for c in ai_caps if c["block"] == k]
LEAD = {"A": 0.15, "B": 0.4, "C": 0.5, "D": 0.3}   # VO start after its section starts (AI clips have no lead silence)
for k in "ABCD":
    if VOCLIP[k].parent == M / 'vo-trim': LEAD[k] = 0.0
TAIL = 0.25
base = {k: sum(s[3] for s, b in zip(SEGS, BLOCK) if b == k) for k in "ABCDL"}
need = {k: LEAD[k] + VOLEN[k] + TAIL for k in "ABCD"}
sec = {k: max(base[k], need[k]) for k in "ABCD"}; sec["L"] = base["L"]
if any(VOCLIP[k].parent == M / "vo-trim" for k in "ABCD"):
    # human voice: fit each section to its clip, then share what is left of MAX_TOTAL
    sec = {**{k: need[k] for k in "ABCD"}, "L": 1.0}
    extra = MAX_TOTAL - sum(sec.values())
    if extra > 0:
        for k, w in (("A", 0.15), ("B", 0.35), ("C", 0.05), ("D", 0.3), ("L", 0.15)): sec[k] += extra * w
over = sum(sec.values()) - MAX_TOTAL
# 1) trim visual dwell beyond the voice, 2) shorten title and links
for k in "BCDA":
    if over <= 0: break
    cut = min(over, sec[k] - max(need[k], 2.0)); sec[k] -= max(cut, 0); over -= max(cut, 0)
for k, lo in (("A", 3.0), ("L", 0.8)):
    if over <= 0: break
    cut = min(over, sec[k] - max(lo, need.get(k, 0) if k != "A" else lo)); sec[k] -= max(cut, 0); over -= max(cut, 0)
if over > 0.001: print(f"WARNING: voice-over too long by {over:.2f} s for {MAX_TOTAL} s")
SEGS = [(*s[:3], round(s[3] * sec[b] / base[b], 3), *s[4:]) for s, b in zip(SEGS, BLOCK)]
starts, t = {}, 0.0
for s, b in zip(SEGS, BLOCK):
    starts.setdefault(b, t); t += s[3]
VO = {k: starts[k] + LEAD[k] for k in "ABCD"}
caps = [{"block": k, "start": VO[k] + c["start"], "end": VO[k] + c["end"], "text": c["text"]} for k in "ABCD" for c in CAPREL[k]]
(M / "captions-final.json").write_text(json.dumps(caps, indent=1))
subprocess.run(["node", str(H / "scripts/cards.mjs"), str(C), str(M / "captions-final.json")], check=True, cwd=H.parents[3])
print("sections", {k: round(v, 2) for k, v in sec.items()}, "VO at", {k: round(v, 2) for k, v in VO.items()})
def run(args): subprocess.run(args, check=True)
parts = []
for i, (kind, src, ss, dur, sp, crop, tag, lt) in enumerate(SEGS):
    out = M / f"seg/{i:02d}.mp4"
    ins, f = [], []
    if kind == "png":
        p = C / f"{src}.png" if not src.startswith("code:") else M / f"code/{src[5:]}.png"
        ins += ["-loop", "1", "-t", str(dur), "-i", str(p)]
        f.append(f"[0:v]scale=1920:1080,fps={FPS},format=yuv420p,setsar=1[b]")
    else:
        ins += ["-ss", str(ss), "-t", str(dur * sp + 0.2), "-i", str(M / f"{src}.mp4")]
        c = f"crop={crop}," if crop else ""
        f.append(f"[0:v]{c}scale=1920:1022,setpts=(PTS-STARTPTS)/{sp},fps={FPS},pad=1920:1080:0:0:white,setsar=1[b]")
    last = "b"; n = 1
    for ov, en in ((f"tag-{tag}" if tag else None, None), (f"lt-{lt}" if lt is not None else None, f"between(t,0.25,{dur - 0.15})")):
        if ov is None: continue
        ins += ["-loop", "1", "-t", str(dur), "-i", str(C / f"{ov}.png")]
        e = f":enable='{en}'" if en else ""
        f.append(f"[{last}][{n}:v]overlay=0:0{e}[o{n}]"); last = f"o{n}"; n += 1
    f.append(f"[{last}]scale=out_range=tv,format=yuv420p[fin]"); last = "fin"
    run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", ";".join(f), "-map", f"[{last}]", "-color_range", "tv", "-t", str(dur), "-r", str(FPS), "-c:v", "libx264", "-preset", "fast", "-crf", "17", "-pix_fmt", "yuv420p", str(out)])
    parts.append(out)
(M / "seg/list.txt").write_text("".join(f"file '{p}'\n" for p in parts))
run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(M / "seg/list.txt"), "-c", "copy", str(M / "seg/picture.mp4")])
total = sum(s[3] for s in SEGS)
# captions + audio
ins = ["-i", str(M / "seg/picture.mp4")]; f = []; last = "0:v"; n = 1
for i, c in enumerate(caps):
    nxt = caps[i + 1]["start"] if i + 1 < len(caps) else total
    ins += ["-loop", "1", "-t", str(total), "-i", str(C / f"cap-{i}.png")]
    a, b = c["start"], min(c["end"] + 0.12, nxt - 0.02, total)
    f.append(f"[{last}][{n}:v]overlay=0:0:enable='between(t,{a:.2f},{b:.2f})'[v{n}]"); last = f"v{n}"; n += 1
amix = []
for k, t in VO.items():
    ins += ["-i", str(VOCLIP[k])]
    norm = "loudnorm=I=-19:TP=-2:LRA=11," if VOCLIP[k].parent == M / 'vo-trim' else ""
    f.append(f"[{n}:a]{norm}aresample=48000,adelay={int(t*1000)}|{int(t*1000)}[a{k}]"); amix.append(f"[a{k}]"); n += 1
bed = H.parent / "video/music/bed.wav"
if bed.exists():
    ins += ["-i", str(bed)]; f.append(f"[{n}:a]aresample=48000,volume=0.10,afade=t=out:st={total-1.5}:d=1.5[abed]"); amix.append("[abed]"); n += 1
f.append(f"{''.join(amix)}amix=inputs={len(amix)}:normalize=0,apad,atrim=0:{total}[a]")
dst = O / "sparkleteam-demo-60s.mp4"
run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", ";".join(f), "-map", f"[{last}]", "-map", "[a]", "-t", f"{total}", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(dst)])
print(dst, total)
