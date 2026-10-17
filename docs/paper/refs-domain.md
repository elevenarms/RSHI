# Domain references: notes for "Towards Recursive Self Home Improvement"

Written 17 October 2026. BibTeX is in `refs-domain.bib` (43 entries). For every entry the
title, authors, venue and year were checked against the source opened, and every DOI was
resolved through `api.crossref.org`. Entries with no DOI were checked against the arXiv or
proceedings page given. Nothing in this file comes from memory alone.

## Dropped or corrected while checking

- **"Learning to load a dishwasher with transformers"**: no paper has this title. The work it
  probably means is `jain2023transformers` (Transformers Are Adaptable Task Planners, CoRL
  2022 / PMLR 205), which learns dishwasher-loading preferences in simulation.
- **"Ha et al." on dishwasher loading**: no such paper found. Dropped.
- **Voysey et al.**: Engineering Reports, not arXiv. Crossref gives the online date as Nov 2020
  and the issue as vol. 3 no. 5 (2021).
- **Brückner, Schneider, Stamminger 2012**: Crossref gives the second author as "M. Schneider".
- **AHAM**: DW-1-2020 is the *energy* test method. The cleaning-performance method is
  **DW-2-2020**, so cite `aham_dw2_2020` for cleaning.
- **EN 50242** is superseded by EN 60436 (standards.md §2.1). `en60436_2020` covers it; cite
  EN 50242 only for history.
- **CMA-ES DOI** resolves to MIT Press Evolutionary Computation 9(2):159-195.

## (1) Dishwasher loading and the domestic task

| Key | Relevance (one sentence) | Verified at |
|---|---|---|
| voysey2021dishwasher | A robot pipeline that loads a dishwasher from cluttered trays: prior work on the same physical task, but about grasping rather than wash outcome. | doi:10.1002/eng2.12321 |
| kapelyukh2021myhouse | Learns a user's arrangement preferences with GNNs. Loading treated as rearrangement to match a person's taste, with no physical cleanliness score. | PMLR v164; arXiv 2111.03112 |
| jain2023transformers | A transformer task planner trained on dishwasher-loading preferences in simulation. The closest learned dishwasher-loading baseline, scored on matching a demonstrated preference rather than on clean dishes. | PMLR v205:1011-1037 |
| lin2021gnn | A GNN manipulation policy shown on dishwasher loading in Habitat Sim. | arXiv 2102.13177 |
| iec60436_2025 | The current international test method (Ed. 5, new reference machine). It is the basis of DishwasherBench's item scoring and "clean" threshold. | IEC webstore pub. 80459 |
| en60436_2020 | The EU edition (Ed. 4.1) behind the round robin and the EU energy label. It replaces EN 50242. | VDE preview (repo standards.md S1) |
| aham_dw2_2020 | The US cleaning-performance test (0-9 grading), a contrast to IEC adhesion soils. | law.resource.org PDF; DOE FR 2023 |
| aham_dw1_2020 | The US energy test method. Cite it only to say that DW-1 is not the cleaning test. | law.resource.org PDF |
| eilts2023roundrobin | A 17-lab round robin. It shows that compliant machines do not clean everything (class means 2.3-4.8), and its Bosch SMV6ECX51E means are what DishwasherBench calibrates its soil defaults on. | hs-albsig.de PDF (title page read) |
| richter2011usage | An observational study of how consumers actually load and run dishwashers at home. | doi:10.1111/j.1470-6431.2010.00973.x |
| richter2010automatic | Consumer habits erode the efficiency of automatic dishwashers, which motivates loading as a skill. | doi:10.1111/j.1470-6431.2009.00839.x |
| bruckner2015consumer | A consumer-relevant test procedure for "auto" programmes (Bonn). | doi:10.1007/s12053-014-9284-4 |
| bruckner2012placesetting | Argues that the standard place setting does not reflect real household loads. | doi:10.3139/113.110166 |
| perezmohedano2015pept | PEPT tracking of water in a real dishwasher: jets reach only small areas, with the slowest flow at the edges of the lower basket. This is the main empirical basis for spray shadowing. | doi:10.1016/j.cej.2014.08.033 |
| perezmohedano2017integrated | A model that couples jet coverage with soil-removal kinetics to predict cleaning profiles. It is the closest prior work to the DishwasherBench wash model. | doi:10.1016/j.jfoodeng.2016.09.031 |
| perezmohedano2016thesis | The EngD thesis behind the two papers above (repo standards.md S16). | etheses.bham.ac.uk 6590 |
| fryer2009cleaningmap | Classifies cleaning by soil type and by the mechanical/chemical/thermal mechanism. It frames the per-soil models. | doi:10.1016/j.tifs.2009.03.005 |

## (2) Packing and combinatorial optimisation

| Key | Relevance | Verified at |
|---|---|---|
| garey1979computers | The standard reference for NP-completeness. Bin packing is problem SR1. | catalogue records; ISBN 0716710455 |
| kellerer2004knapsack | A monograph on knapsack. Choosing which items to load for points under capacity has knapsack structure. | doi:10.1007/978-3-540-24777-7 |
| martello2000threedim | Shows that 3D bin packing is strongly NP-hard, and gives an exact branch-and-bound method. The geometric core of loading is harder still. | doi:10.1287/opre.48.2.256.12386 |
| wang2019stable | Packing irregular non-convex 3D objects under stability constraints in a physics simulator. The closest packing analogue to rigid-body dishwasher loading. | doi:10.1109/ICRA.2019.8794049 |
| zhao2021online | Online 3D bin packing with deep RL under stability constraints. A learned-packing baseline family. | doi:10.1609/aaai.v35i1.16155 |
| romeraparedes2024funsearch | Also counts as LLM-based packing: FunSearch evolves online bin-packing heuristics. | (see 3) |

## (3) Search and evolution baselines, and LLM + evolution hybrids

| Key | Relevance | Verified at |
|---|---|---|
| holland1975adaptation | The origin of genetic algorithms. | U. Michigan Press 1975; ISBN 0472084607 |
| goldberg1989genetic | The standard GA textbook. | Addison-Wesley 1989; ISBN 0201157675 |
| hansen2001cmaes | CMA-ES, the default evolution strategy for continuous parameters (for example, placement poses). | doi:10.1162/106365601750190398 |
| kocsis2006uct | UCT, bandit-guided Monte-Carlo tree search. A natural planner over sequential placement actions. | doi:10.1007/11871842_29 |
| browne2012mcts | A survey of MCTS variants. | doi:10.1109/TCIAIG.2012.2186810 |
| mouret2015mapelites | MAP-Elites quality-diversity. Relevant for keeping diverse loading strategies rather than one elite. | arXiv 1504.04909 |
| snoek2012practical | GP-based Bayesian optimisation for expensive black-box evaluations, such as a GPU wash per evaluation. | NIPS 2012; arXiv 1206.2944 |
| romeraparedes2024funsearch | An LLM proposes programs and an evaluator scores them in an evolutionary loop. The closest precedent for LLM-driven improvement of a system against a deterministic scorer. | doi:10.1038/s41586-023-06924-6 |
| guo2024evoprompt | Evolves prompts with LLMs acting as mutation and crossover operators. The precedent for evolving the weak loader's prompt or harness. | ICLR 2024; arXiv 2309.08532 |
| yang2024opro | An LLM used as the optimiser, conditioned on the history of earlier solutions and their scores. | ICLR 2024; arXiv 2309.03409 |
| novikov2025alphaevolve | A coding agent with evaluator-guided evolution. Mention only, as the large-model counterpart to a cheap open-weight team. | arXiv 2506.13131 |

## (4) Methodology and embodied/household benchmarks

| Key | Relevance | Verified at |
|---|---|---|
| dror2018hitchhiker | A guide to significance tests (paired permutation, bootstrap, sign tests) for comparing two systems on the same test items. It fits paired per-level or per-seed comparisons. | doi:10.18653/v1/P18-1128 |
| wald1945sequential | The SPRT. The basis for stopping an accept/reject evaluation of a candidate early. | doi:10.1214/aoms/1177731118 |
| benjamini1995fdr | False-discovery-rate control when many candidate changes are tested. | doi:10.1111/j.2517-6161.1995.tb02031.x |
| gelman2013forking | Data-dependent analysis choices inflate false positives even without explicit fishing. This is the risk in iterative accept/reject on one benchmark. | Columbia working paper PDF |
| dwork2015reusable | The reusable holdout (Thresholdout). Repeated adaptive queries against a holdout overfit it, and the paper shows how to guard against that. It directly motivates keeping a held-out level set for the self-improvement loop. | doi:10.1126/science.aaa9375 |
| oren2024contamination | Black-box test for benchmark contamination. Motivates held-out/unseen levels for LLM evaluation. | ICLR 2024; arXiv 2310.17623 |
| srivastava2021behavior | 100 household activities in simulation. The household-benchmark context: success there is a symbolic goal predicate, not a physical outcome. | PMLR v164:477-490; arXiv 2108.03332 |
| shridhar2020alfred | Instruction following for household tasks (25k directives). | doi:10.1109/CVPR42600.2020.01075 |
| savva2019habitat | An embodied-AI simulation platform. | doi:10.1109/ICCV.2019.00943 |
| puig2018virtualhome | Household activities as programs in a simulator. | doi:10.1109/CVPR.2018.00886 |

**Positioning line for the paper.** Prior household benchmarks (BEHAVIOR, ALFRED, VirtualHome,
Habitat) score symbolic goal satisfaction. Prior dishwasher-loading work (Voysey, Jain,
Kapelyukh, Lin) scores grasp success or agreement with a human preference. To our knowledge
none scores the physical outcome, whether the items come out clean, against a performance
standard (IEC 60436), and that is the gap DishwasherBench fills.

## DishwasherBench facts worth citing (with source in the repo)

1. The same load always settles the same way: Jolt rigid-body loading runs at a fixed step,
   inputs are rounded to 1 mm and 1 degree, and each action is logged with a scene hash that
   replay must reproduce. Source: `README.md`, "How it works".
2. "Clean" means at most 4 specks and 4 mm² of visible soil per item, residue left by standing
   dirty water included. Source: `README.md`; derivation in `docs/research/standards.md` §10.
3. The machine is measured from photographs: 10+1 nozzles on the lower arm and 7 on the upper,
   tub width 545 mm, and photo error of about 2-3 mm on heights and about 3 % on widths, checked
   by an independent repeat. Source: `docs/research/machine-bosch-smv4hax40g.md`, lines 16-17
   and 75.
4. Wash physics: GPU-traced jets from the measured nozzles, droplets, surface film, pooling and
   drainage, and per-soil removal driven by time, temperature, detergent, enzymes and bleach. The
   official tier uses 2 mm blocks and the fast tier 4 mm. Source: `README.md`.
5. Calibration on real washes: two owner test washes on the real SMV4HAX40G (Eco 50, Finish
   Powerball Ultimate capsule at 12.9 g, eight egg-yolk plates, air-dried and oven-dried 2 h at
   80 °C). The fitted set `anchored-v8` reproduces every verdict the owner saw, with one small
   plate on the edge of clean. Source: `docs/calibration/anchoring-v8.md`;
   `docs/validation/README.md` §1-2.
6. In the first wash the prediction was written before the result. It got the order of the
   plates right but was 10-30× too optimistic about residue on the oven-dried plates, which led
   to a refit (pump duty of the soak moved from 0.5 to 0.8). Source: `docs/validation/README.md`
   §1.
7. The defaults are anchored to the published class means of the sister machine Bosch
   SMV6ECX51E: cutlery within 0.15, crockery 0.2 low, glass 0.35-0.45 high, whole load within
   0.1. This is a fit, not a prediction. Source: `docs/validation/README.md` §1.
8. Real machines do not clean everything: the 2022/23 round robin over 17 labs reports class
   means of cutlery 4.6-4.8, crockery 2.3-3.7, glass 2.3-4.0 and pots 2.5-4.0 (0-5 scale). An EU
   machine needs a mean of about 3.9 to pass (1.12 × reference). Source:
   `docs/research/standards.md` §1 and §6.3.
9. Validation suite: of 46 loading phenomena drawn from the literature, 9 are out of scope; of
   the remaining 37, 17 pass, 19 fail in size or sign and 1 is a faulty scenario. Most expected
   effect sizes are estimates, because no published controlled loading-pattern experiment
   exists. Source: `docs/validation/README.md` §1; `docs/research/standards.md` §0.2.
10. Water is conserved exactly. The fast tier agrees with the official tier on 91 % of verdicts
    of the standard load and on 97 % of verdicts on the levels. An official wash of the largest
    level takes 4.9 minutes. About three quarters of the gap between a careful and a careless
    reference load comes from hollow pieces placed mouth up, and how plates and cutlery are
    stacked affects the score very little. Sources: `docs/validation/README.md` §1; `README.md`,
    "Scope and limitations".
