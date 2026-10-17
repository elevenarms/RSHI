# /// script
# requires-python = ">=3.10"
# dependencies = ["sounddevice", "soundfile", "numpy"]
# ///
"""Record the SparkleTeam demo voice-over, one clip at a time.

Run from anywhere (uv installs the dependencies on first run):

    uv run /Users/elevenarms/Code/wash/DishwasherBench/docs/crew/launch/demo/record_vo.py

For each clip: read the text, press Enter, wait for the count-in, speak, press Enter to stop.
Then (p)lay it back, (k)eep it, or (r)edo it. Kept takes are saved as vo-human/A.wav ... D.wav
(48 kHz, mono, 24-bit) next to this script. Run with a letter to redo one clip only:

    uv run record_vo.py B

The first run, macOS asks for microphone access for your terminal app: allow it.
"""

import queue
import sys
import threading
import time
from pathlib import Path

import numpy as np
import sounddevice as sd
import soundfile as sf

RATE = 48_000
OUT = Path(__file__).resolve().parent / "vo-human"

CLIPS = [
    ("A", "Title", 5.0,
     "SparkleTeam: / a self-improving team of open Nemotron models, / built today on Crusoe."),
    ("B", "The live Studio (relaxed pace)", 35.0,
     "This is the real tool, running. /\n"
     "A deliberately weak loader plays DishwasherBench, a real physics simulation, / "
     "placing every item by tool call. /\n"
     "Every token streams from Crusoe as it is generated. /\n"
     "The Critic writes lessons into memory. /\n"
     "The Coach rewrites the team's own genome, as typed edits. /\n"
     "And a deterministic Gatekeeper keeps a change only if it wins on paired drills. /\n"
     "The score chart moves only when the Gatekeeper says so."),
    ("C", "Code", 7.0,
     "All of it built today: / the crew package, the Studio, / and the water effects."),
    ("D", "Results (brisk)", 12.0,
     "Finding one: / cups mouth up, zero of eleven clean. / Mouth down, twenty-six for twenty-six. /\n"
     "And we caught the team learning a superstition: / the gain did not replicate. /\n"
     "Next: fine-tune the noisy loader.\n\n"
     "(Shorter, if it won't fit: Finding one: cups mouth up, zero of eleven clean. Mouth down,\n"
     " twenty-six for twenty-six. / And we caught the team learning a superstition. /\n"
     " Next: fine-tune the loader.)"),
]

BOLD, DIM, RED, GREEN, AMBER, RESET = "\033[1m", "\033[2m", "\033[31m", "\033[32m", "\033[33m", "\033[0m"


def record(limit: float) -> np.ndarray:
    """Record until Enter is pressed; show elapsed time against the clip's limit and a level meter."""
    chunks: "queue.Queue[np.ndarray]" = queue.Queue()
    level = [0.0]

    def callback(indata, frames, t, status):  # noqa: ARG001
        chunks.put(indata.copy())
        level[0] = float(np.sqrt(np.mean(indata**2)))

    stop = threading.Event()
    threading.Thread(target=lambda: (input(), stop.set()), daemon=True).start()
    with sd.InputStream(samplerate=RATE, channels=1, dtype="float32", callback=callback):
        start = time.time()
        while not stop.is_set():
            el = time.time() - start
            bars = int(min(1.0, level[0] * 8) * 30)
            colour = RED if el > limit else (AMBER if el > limit * 0.85 else GREEN)
            meter = ("#" * bars).ljust(30)
            print(f"\r  {colour}● REC {el:5.1f}s / {limit:.0f}s{RESET}  [{meter}]  Enter = stop ", end="", flush=True)
            time.sleep(0.05)
    print()
    audio = np.concatenate(list(chunks.queue)) if not chunks.empty() else np.zeros((0, 1), np.float32)
    return audio[:, 0]


def trim(audio: np.ndarray, pad: float = 0.5) -> np.ndarray:
    """Trim leading and trailing silence, keeping `pad` seconds of room tone at each end."""
    if audio.size == 0:
        return audio
    win = int(RATE * 0.02)
    env = np.sqrt(np.convolve(audio**2, np.ones(win) / win, mode="same"))
    loud = np.where(env > max(0.01, env.max() * 0.05))[0]
    if loud.size == 0:
        return audio
    a = max(0, loud[0] - int(RATE * pad))
    b = min(audio.size, loud[-1] + int(RATE * pad))
    return audio[a:b]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    only = {a.upper() for a in sys.argv[1:]}
    clips = [c for c in CLIPS if not only or c[0] in only]
    try:
        dev = sd.query_devices(kind="input")
        print(f"{DIM}Microphone: {dev['name']}  ·  saving to {OUT}{RESET}")
    except Exception as e:  # noqa: BLE001
        sys.exit(f"No input device available ({e}). Check System Settings → Privacy & Security → Microphone.")

    for key, name, limit, text in clips:
        while True:
            print(f"\n{BOLD}── Clip {key} · {name} · fit in {limit:.0f} s ──{RESET}\n")
            print("  " + text.replace("\n", "\n  "))
            input(f"\n  {DIM}Press Enter, then start speaking after the count-in…{RESET}")
            for n in (3, 2, 1):
                print(f"  {n}…", end="", flush=True)
                time.sleep(0.6)
            print()
            audio = trim(record(limit))
            dur = audio.size / RATE
            peak = float(np.abs(audio).max()) if audio.size else 0.0
            note = f"{RED}over by {dur - limit:.1f}s{RESET}" if dur > limit else f"{GREEN}fits{RESET}"
            clip_warn = f"  {RED}(clipping: move back a little){RESET}" if peak > 0.98 else ""
            quiet_warn = f"  {AMBER}(very quiet: move closer){RESET}" if 0 < peak < 0.1 else ""
            print(f"  {dur:.1f}s after trimming: {note}{clip_warn}{quiet_warn}")
            while True:
                choice = input("  (p)lay  (k)eep  (r)edo  > ").strip().lower()[:1]
                if choice == "p":
                    sd.play(audio, RATE)
                    sd.wait()
                elif choice in ("k", "r"):
                    break
            if choice == "k":
                path = OUT / f"{key}.wav"
                sf.write(path, audio, RATE, subtype="PCM_24")
                print(f"  {GREEN}saved {path}{RESET}")
                break

    print(f"\n{BOLD}Done.{RESET} Tell Claude the voice-over is in {OUT} and it will rebuild the demo with your voice.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped. Clips you kept are saved; rerun with a letter (e.g. `B`) to redo one.")
