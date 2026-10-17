# Loader SFT set (not uploaded; no fine-tuning job was started)

For Crusoe Serverless Fine-Tuning (LoRA SFT), target base model `nvidia/nemotron-3.5-lightning-30b-a3b`. Built by `pnpm --filter @spotless/crew crew export-sft` from the token-level call logs.

- **Selection:** loader episodes of the training split (purposes train and eval; never exam or test-split episodes, so the held-out drills stay clean), not failed, share >= 0.6, played by a genome the team kept (G0-fc671e, G1-321329, G2-704108).
- **Runs:** 2026-10-17T20-49-49-evolve.
- **Episodes:** 7, mean share **0.854**; **examples:** 40 (one per context segment: the full request before each fold of the conversation, plus the model's answer; every assistant turn appears in at least one example; where the harness only pruned an old picture rather than folding, consecutive examples overlap and repeat earlier assistant turns).
- **Size:** about 533,234 tokens (characters / 4) in `loader-sft.jsonl`.

Files:
- `loader-sft.jsonl`: one `{"messages": [...]}` per line with roles system / user / assistant only, the format Crusoe's fine-tuning docs document. Tool calls are serialised as `<tool_call>{"name":..., "arguments":...}</tool_call>` in the assistant text, and tool results as `<tool_result id=...>...</tool_result>` in the following user turn.
- `loader-sft-tools.jsonl`: the same conversations in OpenAI tool format (`tools`, assistant `tool_calls`, `tool` messages), for a trainer that takes tool calls. The docs do not document this schema; check the API reference before using it.

Pictures are not included: the loader's renders appear as `[png sha256:... bytes]` notes, which suits the text-only Lightning model. Thinking was off for the loader, so the set has no reasoning traces.

Episodes:

| run | episode | genome | drill | share | examples |
|---|---|---|---|---|---|
| 2026-10-17T20-49-49-evolve | eval-G0-fc671e-drill-tutorial-12-s1000-5 | G0-fc671e | drill-tutorial-12-s1000 | 0.875 | 10 |
| 2026-10-17T20-49-49-evolve | eval-G1-321329-drill-tutorial-12-s2000-21 | G1-321329 | drill-tutorial-12-s2000 | 0.813 | 5 |
| 2026-10-17T20-49-49-evolve | eval-G1-321329-drill-lunch-for-four-12-s2001-22 | G1-321329 | drill-lunch-for-four-12-s2001 | 0.676 | 6 |
| 2026-10-17T20-49-49-evolve | eval-G1-321329-drill-tutorial-12-s3000-24 | G1-321329 | drill-tutorial-12-s3000 | 0.969 | 2 |
| 2026-10-17T20-49-49-evolve | eval-G1-321329-drill-lunch-for-four-12-s3001-25 | G1-321329 | drill-lunch-for-four-12-s3001 | 0.806 | 8 |
| 2026-10-17T20-49-49-evolve | eval-G2-704108-drill-lunch-for-four-12-s3001-31 | G2-704108 | drill-lunch-for-four-12-s3001 | 0.968 | 4 |
| 2026-10-17T20-49-49-evolve | eval-G2-704108-drill-tutorial-12-s3000-30 | G2-704108 | drill-tutorial-12-s3000 | 0.875 | 5 |
