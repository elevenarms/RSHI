"""Assembles the launch video from timeline.json: manim renders, 3D captures and UI stills,
the per-scene voice-over WAVs and an optional music bed with ducking.

    .venv/bin/python scripts/compose.py [timeline.json] [--out out/sparkleteam.mp4] [--draft]

Rules
- A scene's length is max(its clips' natural length, its VO + breath). The extra time goes to
  the scene's stretch clip (the one with "stretch": true, else the last clip) as a held last
  frame: visuals stretch, the voice is never sped up.
- A missing VO file means silence for the scene's natural length.
- Clips: {"type": "manim", "class": "Hook"}            renders/manim/<class>.mp4
         {"type": "video", "file": "captures/3D-01.mp4", "trim": [s, e]}
         {"type": "still", "file": "...png", "seconds": 3, "zoom": [1, 1.2], "focus": [0.5, 0.5], "frame": "Fig. 4 · ..."}
         {"type": "hstack", "files": [a, b], "labels": ["G0  28/71", "champion  63/71"]}
         {"type": "slot", "label": "...", "seconds": 10}   (skipped unless "show": true)
  Common: "seconds" (cap), "tag" (top-right black tag), "caption" (lower-left) with
  "caption_at": [t0, t1], "in": "cut" | "dip" (8-frame dip to white) | {"xfade": seconds}.
- Writes out/edl.json (start time of every scene and clip) for the teaser and the poster.
"""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

VIDEO = Path(__file__).resolve().parent.parent
FONTS = Path.home() / "Library/Fonts"
FONT_REG = str(FONTS / "JetBrainsMono-Regular.ttf")
FONT_SEMI = str(FONTS / "JetBrainsMono-SemiBold.ttf")
W, H, FPS = 1920, 1080, 30


def run(cmd: list[str]) -> None:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(" ".join(cmd) + "\n" + r.stderr[-3000:])
        raise SystemExit(f"ffmpeg failed ({cmd[-1]})")


def duration(path: Path) -> float:
    r = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True,
    )
    return float(r.stdout.strip())


# ---------------------------------------------------------------------------------------------
# Overlays (Pillow: this ffmpeg build has no drawtext)
# ---------------------------------------------------------------------------------------------


def spaced(draw: ImageDraw.ImageDraw, xy, text: str, font, fill, spacing: float) -> float:
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += draw.textlength(ch, font=font) + spacing
    return x


def text_width(draw, text, font, spacing) -> float:
    return sum(draw.textlength(c, font=font) + spacing for c in text) - spacing


def overlay_png(path: Path, tag: str | None = None, caption: str | None = None, labels: list[str] | None = None) -> Path:
    """A transparent 1920×1080 PNG: a black tag top-right, a caption lower-left, column labels."""
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if tag:
        f = ImageFont.truetype(FONT_SEMI, 17)
        t = tag.upper()
        sp = 17 * 0.08
        tw = text_width(d, t, f, sp)
        x1, y0 = W - 56, 48
        x0 = x1 - tw - 28
        d.rectangle([x0, y0, x1, y0 + 34], fill=(0, 0, 0, 255))
        spaced(d, (x0 + 14, y0 + 7), t, f, (255, 255, 255, 255), sp)
    if caption:
        f = ImageFont.truetype(FONT_REG, 24)
        x, y = 64, H - 92
        tw = d.textlength(caption, font=f)
        d.rectangle([x - 16, y - 30, x + tw + 16, y + 40], fill=(246, 246, 244, 225))
        d.line([(x, y - 14), (x + 48, y - 14)], fill=(0, 0, 0, 255), width=2)
        d.text((x, y), caption, font=f, fill=(0, 0, 0, 255))
    if labels:
        f = ImageFont.truetype(FONT_SEMI, 28)
        n = len(labels)
        for i, lab in enumerate(labels):
            cx = W * (2 * i + 1) / (2 * n)
            tw = d.textlength(lab, font=f)
            d.text((cx - tw / 2, H - 150), lab, font=f, fill=(0, 0, 0, 255))
        for i in range(1, n):
            x = W * i / n
            d.line([(x, 120), (x, H - 60)], fill=(0, 0, 0, 255), width=1)
    img.save(path)
    return path


def framed_still(src: Path, dst: Path, caption: str | None) -> Path:
    """A UI still on white at 2× (3840×2160): hairline frame, journal caption underneath."""
    S = 2
    canvas = Image.new("RGB", (W * S, H * S), (255, 255, 255))
    im = Image.open(src).convert("RGB")
    maxw, maxh = int(W * S * 0.86), int(H * S * (0.80 if caption else 0.88))
    scale = min(maxw / im.width, maxh / im.height)
    im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    x = (canvas.width - im.width) // 2
    y = (canvas.height - im.height) // 2 - (40 * S if caption else 0)
    canvas.paste(im, (x, y))
    d = ImageDraw.Draw(canvas)
    d.rectangle([x - 1, y - 1, x + im.width, y + im.height], outline=(0, 0, 0), width=2)
    if caption:
        f = ImageFont.truetype(FONT_REG, 22 * S)
        d.text((x, y + im.height + 22 * S), caption, font=f, fill=(0, 0, 0))
    canvas.save(dst)
    return dst


# ---------------------------------------------------------------------------------------------
# Clips → normalised segments
# ---------------------------------------------------------------------------------------------


def natural_length(clip: dict) -> float:
    t = clip["type"]
    if t == "manim":
        n = duration(VIDEO / "renders/manim" / f"{clip['class']}.mp4")
    elif t == "video":
        n = duration(VIDEO / clip["file"])
        if "trim" in clip:
            n = min(n, clip["trim"][1]) - clip["trim"][0]
    elif t == "hstack":
        n = min(duration(VIDEO / f) for f in clip["files"])
    elif t in ("still", "slot"):
        n = float(clip.get("seconds", 3))
    else:
        raise SystemExit(f"unknown clip type {t}")
    if "seconds" in clip and t not in ("still", "slot"):
        n = min(n, float(clip["seconds"]))
    return n


def render_segment(clip: dict, length: float, natural: float, out: Path, tmp: Path, plate: str, speed: float = 1.0) -> None:
    """`natural` is the clip's own length; `speed` > 1 plays it faster (natural / speed seconds)."""
    t = clip["type"]
    if t in ("still", "slot"):
        natural, speed = natural / speed, 1.0
    inputs: list[str] = []
    pre = ""
    if t == "manim" or t == "video":
        src = VIDEO / "renders/manim" / f"{clip['class']}.mp4" if t == "manim" else VIDEO / clip["file"]
        ss = clip.get("trim", [0])[0]
        inputs = ["-ss", f"{ss}", "-i", str(src)]
        pre = (
            f"[0:v]fps={FPS},scale={W}:{H}:force_original_aspect_ratio=decrease,"
            f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2:color={plate},setsar=1,trim=duration={natural:.4f},setpts=PTS-STARTPTS"
            + (f",setpts=PTS/{speed:.5f},fps={FPS}" if speed != 1.0 else "")
        )
    elif t == "hstack":
        a, b = clip["files"]
        inputs = ["-i", str(VIDEO / a), "-i", str(VIDEO / b)]
        pre = (
            f"[0:v]fps={FPS},scale={W // 2}:{H}:force_original_aspect_ratio=decrease,pad={W // 2}:{H}:(ow-iw)/2:(oh-ih)/2:color={plate}[l];"
            f"[1:v]fps={FPS},scale={W // 2}:{H}:force_original_aspect_ratio=decrease,pad={W // 2}:{H}:(ow-iw)/2:(oh-ih)/2:color={plate}[r];"
            f"[l][r]hstack,setsar=1,trim=duration={natural:.4f},setpts=PTS-STARTPTS"
            + (f",setpts=PTS/{speed:.5f},fps={FPS}" if speed != 1.0 else "")
        )
    elif t == "still":
        framed = framed_still(VIDEO / clip["file"], tmp / (out.stem + "_still.png"), clip.get("frame"))
        z0, z1 = clip.get("zoom", [1.0, 1.0])
        fx, fy = clip.get("focus", [0.5, 0.5])
        n = max(int(round(natural * FPS)), 1)
        inputs = ["-loop", "1", "-framerate", str(FPS), "-t", f"{natural:.4f}", "-i", str(framed)]
        # Eased zoom about the focus point, on a 2× source (sub-pixel steady).
        zexpr = f"({z0})+(({z1})-({z0}))*(0.5-0.5*cos(PI*on/{n}))"
        pre = (
            f"[0:v]zoompan=z='{zexpr}':x='(iw-iw/zoom)*{fx}':y='(ih-ih/zoom)*{fy}':d=1:s={W}x{H}:fps={FPS},"
            f"setsar=1,trim=duration={natural:.4f},setpts=PTS-STARTPTS"
        )
    elif t == "slot":
        card = Image.new("RGB", (W, H), (255, 255, 255))
        d = ImageDraw.Draw(card)
        f = ImageFont.truetype(FONT_SEMI, 40)
        d.text((120, H / 2 - 30), clip.get("label", "SLOT"), font=f, fill=(0, 0, 0))
        p = tmp / (out.stem + "_slot.png")
        card.save(p)
        inputs = ["-loop", "1", "-framerate", str(FPS), "-t", f"{natural:.4f}", "-i", str(p)]
        pre = "[0:v]setsar=1"
    natural = natural / speed
    hold = max(length - natural, 0)
    chain = pre
    if hold > 1e-3:
        chain += f",tpad=stop_mode=clone:stop_duration={hold:.4f}"
    chain += f",trim=duration={length:.4f}"
    # Overlays.
    labels = clip.get("labels") if t == "hstack" else None
    if clip.get("tag") or clip.get("caption") or labels:
        if clip.get("caption"):
            # Caption and tag on separate layers so the caption can be timed.
            if clip.get("tag") or labels:
                ov = overlay_png(tmp / (out.stem + "_tag.png"), tag=clip.get("tag"), labels=labels)
                inputs += ["-i", str(ov)]
                chain += f"[v0];[v0][{count_inputs(inputs) - 1}:v]overlay=0:0"
            cap = overlay_png(tmp / (out.stem + "_cap.png"), caption=clip["caption"])
            inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{length:.4f}", "-i", str(cap)]
            c0, c1 = clip.get("caption_at", [0, length])
            chain += (
                f"[v1];[{count_inputs(inputs) - 1}:v]format=rgba,setpts=PTS-STARTPTS,fade=t=in:st={c0}:d=0.5:alpha=1,"
                f"fade=t=out:st={max(c1 - 0.5, c0 + 0.5)}:d=0.5:alpha=1[cap];[v1][cap]overlay=0:0:eof_action=pass"
            )
        else:
            ov = overlay_png(tmp / (out.stem + "_tag.png"), tag=clip.get("tag"), labels=labels)
            inputs += ["-i", str(ov)]
            chain += f"[v0];[v0][{count_inputs(inputs) - 1}:v]overlay=0:0"
    # Dip to white at the edges.
    fin, fout = clip.get("_dip_in", False), clip.get("_dip_out", False)
    if fin:
        chain += ",fade=t=in:st=0:d=0.1333:color=white"
    if fout:
        chain += f",fade=t=out:st={length - 0.1333:.4f}:d=0.1333:color=white"
    chain += ",format=yuv420p[out]"
    run(
        ["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", chain, "-map", "[out]",
         "-r", str(FPS), "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-an", str(out)]
    )


def count_inputs(inputs: list[str]) -> int:
    return inputs.count("-i")


# ---------------------------------------------------------------------------------------------


def main() -> None:
    args = sys.argv[1:]
    tl_path = VIDEO / next((a for a in args if a.endswith(".json")), "timeline.json")
    out = VIDEO / (args[args.index("--out") + 1] if "--out" in args else "out/sparkleteam.mp4")
    tl = json.loads(tl_path.read_text())
    plate = tl.get("plate", "white")
    tmp = VIDEO / "out/segments"
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)
    out.parent.mkdir(parents=True, exist_ok=True)

    segs: list[tuple[Path, float, float]] = []  # file, length, xfade-in
    edl = {"scenes": [], "clips": []}
    t = 0.0
    vo_inputs: list[tuple[Path, float]] = []
    for scene in tl["scenes"]:
        clips = [c for c in scene["clips"] if not (c["type"] == "slot" and not c.get("show"))]
        if not clips:
            continue
        missing = [c for c in clips if c["type"] == "manim" and not (VIDEO / "renders/manim" / f"{c['class']}.mp4").exists()]
        if missing:
            raise SystemExit(f"scene {scene['id']}: missing render(s) {[c['class'] for c in missing]}")
        naturals = [natural_length(c) for c in clips]
        xf = [float(c["in"]["xfade"]) if isinstance(c.get("in"), dict) else 0.0 for c in clips]
        nat_total = sum(naturals) - sum(xf[1:])
        vo = VIDEO / scene["vo"] if scene.get("vo") else None
        vo_len = duration(vo) if vo and vo.exists() else 0.0
        need = vo_len + float(scene.get("breath", 0.25)) + float(scene.get("vo_offset", 0))
        # Visuals longer than the VO play faster (at most MAX_SPEED×) so the cut follows the voice.
        speed = 1.0
        if vo_len and nat_total > need and scene.get("fit", True):
            speed = min(nat_total / need, float(tl.get("max_speed", 1.25)))
        own = naturals
        naturals = [n / speed for n in naturals]
        nat_total = sum(naturals) - sum(xf[1:])
        target = max(nat_total, need) if vo_len else nat_total
        extra = target - nat_total
        stretch = next((i for i, c in enumerate(clips) if c.get("stretch")), len(clips) - 1)
        scene_start = t - (xf[0] if segs else 0.0)
        if vo_len:
            vo_inputs.append((vo, scene_start + float(scene.get("vo_offset", 0))))
        edl["scenes"].append({"id": scene["id"], "start": round(scene_start, 3), "length": round(target, 3), "vo": vo_len})
        for i, c in enumerate(clips):
            length = naturals[i] + (extra if i == stretch else 0)
            c["_dip_in"] = c.get("in") == "dip"
            nxt = clips[i + 1] if i + 1 < len(clips) else None
            if nxt is None:
                nxt_scene = tl["scenes"][tl["scenes"].index(scene) + 1] if tl["scenes"].index(scene) + 1 < len(tl["scenes"]) else None
                nxt = nxt_scene["clips"][0] if nxt_scene else None
            c["_dip_out"] = bool(nxt and nxt.get("in") == "dip")
            seg = tmp / f"{scene['id']}_{i:02d}.mp4"
            render_segment(c, length, own[i], seg, tmp, plate, speed)
            x = xf[i] if segs else 0.0
            start = t - x
            edl["clips"].append({"scene": scene["id"], "clip": c.get("class") or c.get("file") or c.get("files") or c.get("label"), "start": round(start, 3), "length": round(length, 3)})
            segs.append((seg, length, x))
            t = start + length
            print(f"  {scene['id']} clip {i}: {edl['clips'][-1]['clip']}  {length:.2f}s (natural {own[i]:.2f}, speed {speed:.2f})")
    total = t
    (out.parent / "edl.json").write_text(json.dumps(edl, indent=2))

    # Video: chain the segments (cut = concat, xfade = crossfade).
    inputs: list[str] = []
    for s, _, _ in segs:
        inputs += ["-i", str(s)]
    fc = [f"[{k}:v]settb=AVTB,setpts=PTS-STARTPTS,fps={FPS},format=yuv420p[n{k}]" for k in range(len(segs))]
    acc = "[n0]"
    acc_len = segs[0][1]
    for k in range(1, len(segs)):
        _, length, x = segs[k]
        if x > 0:
            fc.append(f"{acc}[n{k}]xfade=transition=fade:duration={x}:offset={acc_len - x:.4f},settb=AVTB,fps={FPS}[x{k}]")
            acc_len = acc_len + length - x
        else:
            fc.append(f"{acc}[n{k}]concat=n=2:v=1:a=0,settb=AVTB,fps={FPS}[x{k}]")
            acc_len += length
        acc = f"[x{k}]"
    fc.append(f"{acc}tpad=stop_mode=clone:stop_duration=1[vfinal]")
    vlabel = "[vfinal]"

    # Audio: VO placed at its scene's start, music looped and ducked under it.
    n_v = len(segs)
    a_parts = []
    for j, (path, at) in enumerate(vo_inputs):
        inputs += ["-i", str(path)]
        ms = int(round(at * 1000))
        a_parts.append(f"[{n_v + j}:a]aresample=48000,aformat=channel_layouts=mono,adelay={ms}|{ms}[vo{j}]")
    fc += a_parts
    if vo_inputs:
        fc.append("".join(f"[vo{j}]" for j in range(len(vo_inputs))) + f"amix=inputs={len(vo_inputs)}:normalize=0,apad=whole_dur={total:.3f}[vomix]")
    else:
        fc.append(f"anullsrc=r=48000:cl=mono,atrim=duration={total:.3f}[vomix]")
    music = tl.get("music")
    if music and (VIDEO / music["file"]).exists() and "--no-music" not in args:
        inputs += ["-stream_loop", "-1", "-i", str(VIDEO / music["file"])]
        mi = n_v + len(vo_inputs)
        g = music.get("gain_db", -22)
        fade_out = max(total - 3, 0)
        fc.append(
            f"[{mi}:a]aresample=48000,aformat=channel_layouts=mono,atrim=duration={total:.3f},volume={g}dB,"
            f"afade=t=in:d=2,afade=t=out:st={fade_out:.3f}:d=3[mus]"
        )
        fc.append("[vomix]asplit=2[vo_a][vo_sc]")
        duck = music.get("duck_db", 6)
        ratio = max(2.0, duck)  # gentle
        fc.append(f"[mus][vo_sc]sidechaincompress=threshold=0.02:ratio={ratio}:attack=80:release=600[ducked]")
        fc.append("[vo_a][ducked]amix=inputs=2:normalize=0,alimiter=limit=0.95[aout]")
    else:
        fc.append("[vomix]alimiter=limit=0.95[aout]")
    run(
        ["ffmpeg", "-y", "-v", "error", *inputs, "-filter_complex", ";".join(fc),
         "-map", vlabel, "-map", "[aout]", "-t", f"{total:.3f}",
         "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p", "-r", str(FPS),
         "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart", str(out)]
    )
    print(f"→ {out}  ({total:.2f} s)")

    # Teaser and poster.
    teaser = tl.get("teaser")
    if teaser:
        clip = next(c for c in edl["clips"] if c["clip"] == teaser["clip"])
        end = clip["start"] + clip["length"] + float(teaser.get("after", 0))
        start = max(end - float(teaser.get("seconds", 10)), 0)
        tout = out.with_name(out.stem + "-teaser.mp4")
        run(["ffmpeg", "-y", "-v", "error", "-ss", f"{start:.3f}", "-i", str(out), "-t", str(teaser.get("seconds", 10)),
             "-vf", "fade=t=in:d=0.3:color=white", "-af", "afade=t=in:d=0.3,afade=t=out:st=9.2:d=0.8",
             "-c:v", "libx264", "-crf", "18", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(tout)])
        print(f"→ {tout}")
    poster = tl.get("poster")
    if poster:
        clip = next(c for c in edl["clips"] if c["clip"] == poster["clip"])
        at = clip["start"] + float(poster.get("at", clip["length"] - 0.2))
        pout = out.with_name(out.stem + "-poster.png")
        run(["ffmpeg", "-y", "-v", "error", "-ss", f"{at:.3f}", "-i", str(out), "-frames:v", "1", str(pout)])
        print(f"→ {pout}")


if __name__ == "__main__":
    main()
