# SparkleTeam 1-minute demo: voice-over recording script

Read by Dave Rauchwerk. Four clips, about 130 words in total, for the 60-second hackathon demo.

## Where to put the files

Save each clip as a WAV file in **`docs/crew/launch/demo/vo-human/`**, named exactly:

| File | Clip | Must fit in |
|---|---|---|
| `A.wav` | Title | 5 s |
| `B.wav` | The live Studio | 35 s |
| `C.wav` | Code | 7 s |
| `D.wav` | Results | 12 s |

Then tell Claude, who rebuilds the video with your voice, re-times the captions to your words, and
republishes it on the site. If a clip runs long, the picture is stretched, never your voice sped up.
If a clip is missing, the AI voice is used for that clip only.

## How to read it

- Calm, precise, quietly confident: a lab announcing a result it can defend. Play the jokes
  straight; the deadpan is the joke.
- "/" = a short breath pause. Read the numbers clearly.
- Half a second of silence at the start and end of each clip. WAV, 48 kHz (44.1 kHz is fine),
  mono or stereo. A quiet room, the phone or mic about a hand's width from your mouth. Record two or
  three takes of each clip and keep the best.

---

## A · Title (5 s)

> SparkleTeam: / a self-improving team of open Nemotron models, / built today on Crusoe.

## B · The live Studio (35 s, relaxed pace)

> This is the real tool, running. /
> A deliberately weak loader plays DishwasherBench, a real physics simulation, / placing every item by tool call. /
> Every token streams from Crusoe as it is generated. /
> The Critic writes lessons into memory. /
> The Coach rewrites the team's own genome, as typed edits. /
> And a deterministic Gatekeeper keeps a change only if it wins on paired drills. /
> The score chart moves only when the Gatekeeper says so.

## C · Code (7 s)

> All of it built today: / the crew package, the Studio, / and the water effects.

## D · Results (12 s, brisk)

> Finding one: / cups mouth up, zero of eleven clean. / Mouth down, twenty-six for twenty-six. /
> And we caught the team learning a superstition: / the gain did not replicate. /
> Next: fine-tune the noisy loader.

If D won't fit in 12 seconds, use this shorter version:

> Finding one: cups mouth up, zero of eleven clean. Mouth down, twenty-six for twenty-six. /
> And we caught the team learning a superstition. / Next: fine-tune the loader.

---

### Facts behind each line (so you can say them with confidence)

- "Five open Nemotron models": Loader Nemotron-3.5-Super-VL, Planner Super-VL, Critic Nemotron-3-Nano-Omni,
  Coach Nemotron-3-Super-120B, Librarian Nemotron-3-Nano-30B, all on Crusoe Managed Inference.
- "Zero of eleven / twenty-six for twenty-six": cups, mugs, glasses and ramekins washed alone in the
  simulator, mouth up vs mouth down (docs/crew/insights/INSIGHTS.md, Finding 1).
- "The gain did not replicate": the first 4-drill exam showed +17.8 pp; the 12-drill replication
  (24 pairs) showed −0.5 pp, 95% CI −13 to +11, p = 0.83.
- "A superstition": rule R1.1 was accepted on one failure in two loads; controlled washes show every
  mouth-down bowl, 45° included, comes out clean.
