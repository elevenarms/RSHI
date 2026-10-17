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
    ("vid", "watch", 104, 5.5, 4, None, "live4", 6),
    ("png", "code:contracts", 0, 1.15, 1, None, "code", None),
    ("png", "code:genome", 0, 1.15, 1, None, "code", None),
    ("png", "code:gatekeeper", 0, 1.15, 1, None, "code", None),
    ("png", "code:crusoe", 0, 1.15, 1, None, "code", None),
    ("png", "code:water", 0, 1.2, 1, None, "code", None),
    ("png", "card-f1", 0, 6.2, 1, None, None, None),
    ("png", "card-sup", 0, 3.1, 1, None, None, None),
    ("png", "card-null", 0, 1.9, 1, None, None, None),
    ("png", "card-next", 0, 2.4, 1, None, None, None),
    ("png", "card-links", 0, 1.4, 1, None, None, None),
]
VO = {"A": 0.15, "B": 5.9, "C": 39.3, "D": 44.9}
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
caps = json.loads((H / "vo/captions.json").read_text())
ins = ["-i", str(M / "seg/picture.mp4")]; f = []; last = "0:v"; n = 1
for i, c in enumerate(caps):
    ins += ["-loop", "1", "-t", str(total), "-i", str(C / f"cap-{i}.png")]
    a, b = VO[c["block"]] + c["start"], min(VO[c["block"]] + c["end"] + 0.12, total)
    f.append(f"[{last}][{n}:v]overlay=0:0:enable='between(t,{a:.2f},{b:.2f})'[v{n}]"); last = f"v{n}"; n += 1
amix = []
for k, t in VO.items():
    ins += ["-i", str(H / f"vo/{k}.wav")]
    f.append(f"[{n}:a]aresample=48000,adelay={int(t*1000)}|{int(t*1000)}[a{k}]"); amix.append(f"[a{k}]"); n += 1
bed = H.parent / "video/music/bed.wav"
if bed.exists():
    ins += ["-i", str(bed)]; f.append(f"[{n}:a]aresample=48000,volume=0.10,afade=t=out:st={total-1.5}:d=1.5[abed]"); amix.append("[abed]"); n += 1
f.append(f"{''.join(amix)}amix=inputs={len(amix)}:normalize=0,apad,atrim=0:{total}[a]")
dst = O / "sparkleteam-demo-60s.mp4"
run(["ffmpeg", "-y", "-loglevel", "error", *ins, "-filter_complex", ";".join(f), "-map", f"[{last}]", "-map", "[a]", "-t", f"{total}", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(dst)])
print(dst, total)
