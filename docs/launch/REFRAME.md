# The honest reframe (source of truth for paper, deck, site, video)

Decided 17 Oct 2026, 15:25, after the 12-drill replication. Every surface tells this story with
these numbers. Never quote +17.8 pp without the replication beside it.

## The story in one line

We built a team of open models that rewrites its own system and keeps only changes that pass a
measured, paired test. Then we caught it learning superstitions, and measured why.

## Order of emphasis

1. **The system works end to end:** five Nemotron models on Crusoe propose typed edits to their
   own genome; a deterministic Gatekeeper accepts or rejects them on paired drills; memory
   accumulates; every token is logged and replayable.
2. **Finding 1 (deterministic physics, robust):** a cup stood mouth up keeps half its grime.
   Drinkware/ramekins washed alone: mouth up clean 0/11, soil left 49% (CI 28–71), 224 ml of water
   retained; mouth down 26/26 clean, 0% soil, 0 ml. Bowls mouth up held 1.17 L each; one mixing
   bowl held 2.9 L and starved the pump. +60 pp P(clean) (CI 33–87) over 15 hollow items.
   Quantified, not discovered (DishwasherBench docs, phenomenon P01).
3. **Learned superstitions (the headline contribution):**
   - Evolution accepted 2 of 6 proposals, both memory-derived playbook rules. On 3 paired
     validation drills each: +25.1 pp (rule R1.1, bowls) and +15.7 pp (rule R2.1/R2.2, glasses
     mouth down, cutlery upright).
   - A first 4-drill held-out exam showed 46.0% → 63.7% (+17.8 pp, 3/4 wins, sign test p ≈ 0.31).
   - **It did not replicate.** 12 held-out drills × 2 repeats, 24 valid pairs (FINAL): baseline
     47.0%, champion 46.6%, Δ −0.5 pp, bootstrap 95% CI −13 to +11, 12 wins / 10 losses / 2 ties,
     sign test p = 0.83, Wilcoxon p = 0.76. (An interim 23-pair cut gave −0.3 pp; superseded.)
   - Ablation: no single rule carries a significant effect (all p ≥ 0.39); the best variant was the
     champion WITHOUT R1.1 (0.552, +0.08 vs baseline, n.s.).
   - Finding 1 at the official tier (spot check): mug and tumbler mouth up kept 90% / 89% of soil;
     mouth down both clean, so the effect holds and is stronger at full fidelity.
   - Transfer (n.s.): champion genome vs baseline on DeepSeek-V4-Flash +15 pp (8/3, p = 0.23),
     gpt-oss-120b +8 pp (p = 0.75).
   - Missed by the team: pots are hardest (mouth up kept 95–100% soil, held 2–7 L); bowls left out
     21/21 times although every bowl kind washes clean mouth down.
   - **Why: the weak loader's sampling noise.** The same genome on the same drill differed by
     0.20 share on average between repeats (up to 0.80; one drill scored 0.000 and 0.803).
     With per-drill SD ≈ 0.3, 3–4 paired drills cannot resolve a 3 pp margin; even 23 pairs only
     resolve about ±12 pp.
   - **The superstition:** R1.1 ("do not place the cereal bowl upper-rack mouth-down tilted 45°")
     rested on 1 failure in 2 loads. The controlled sweep washed every mouth-down bowl clean,
     45° included. The memory never saw a mouth-up hollow item, so it learned "mouth down" from
     successes only, and its biggest real loss (items left out: cereal bowls left out 21 times,
     never loaded) was never targeted.
   - **The good rule:** R2.1 (glasses mouth down) is real physics: it matches Finding 1. So the
     team learned one true rule and one superstition, and the Gatekeeper could not tell them apart.
4. **The lesson / contribution:** a self-improving loop on a noisy weak model needs (a) many more
   paired drills and repeats per drill, (b) a statistical acceptance test (sequential test or CI)
   instead of a fixed margin, and (c) a physics check of each learned rule (cheap controlled
   washes) before it enters the playbook, i.e. falsify the lesson, not just score the genome.
   Deterministic simulators make (c) possible: a learned rule can be tested directly.

## Next step: fine-tune the noisy loader (proposed, not a result)

- The scaffold can only steer a noisy policy; the noise itself lives in the weights. The next
  recursion is to distil the team's experience into the loader: supervised fine-tuning (LoRA) of
  the weak loader on the team's best trajectories, i.e. the episodes that scored well under accepted
  genomes, taken verbatim from the token-level call logs (calls.jsonl already records every
  request and response in chat format).
- Crusoe Serverless Fine-Tuning supports `nvidia/nemotron-3.5-lightning-30b-a3b` (LoRA SFT from a
  JSONL of chat conversations; checkpoints deploy via Self-Serve Deployments). Our first weak
  loader was exactly Lightning, so a fine-tuned Lightning on a dedicated Self-Serve Deployment
  would also escape the shared-endpoint throttling (about 5 calls/min) that sidelined it.
  Super-VL is not on the fine-tuning list.
- Expected effects, to be tested with the same replication protocol: higher mean, and above all
  LOWER variance between repeats, so that the Gatekeeper's paired test can resolve real gains and
  stop accepting superstitions. Then the loop closes: the scaffold discovers, the Gatekeeper
  verifies (now with enough power), and fine-tuning consolidates.
- Wording: always "we propose" / "next", never "we fine-tuned". If the SFT dataset export exists
  (docs/crew/insights/sft/), cite its size (examples, episodes, mean score).

## Wording

- Headline options: "SparkleTeam learned to load a dishwasher, and learned a superstition."
  / "Self-improvement that knows when it's fooling itself."
- Tone: rigorous, deadpan, unembarrassed. A null replication is reported as a finding, not
  hidden. "We report, with appropriate gravity, that our team became superstitious."
- Ablation (rules on/off) is still running; if it lands, cite it. Otherwise say "an ablation is
  in progress" and lean on the controlled sweep.

Data: docs/crew/insights/INSIGHTS.md and data/; runs 2026-10-17T21-34-04-exam and
2026-10-17T21-50-44-exam (12-drill, repeats 1 and 2), 2026-10-17T20-49-49-evolve (evolution,
4-drill exam).
