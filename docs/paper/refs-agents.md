# Related work: agents, self-improvement, memory, multi-agent
Verified 2026-10-17 against arXiv API records (abs URLs below) or publisher pages. Venue notes in parentheses come from arXiv comments or are well-established; entries otherwise cited as arXiv preprints.

## Self-improvement of agent scaffolds
- **zhang2025dgm**: Darwin Gödel Machine: Open-Ended Evolution of Self-Improving Agents. Zhang, Jenny, Hu, Shengran, Lu, Cong et al.. arXiv preprint, 2025. arXiv:2505.22954. https://arxiv.org/abs/2505.22954
  - Closest prior: a fixed foundation model whose agent code is self-modified and kept only if it improves on a coding benchmark with empirical validation; we do the same on the scaffold/genome, with physics reward and paired-seed acceptance instead of archive-based open-ended search.
- **hu2024adas**: Automated Design of Agentic Systems. Hu, Shengran, Lu, Cong, Clune, Jeff. ICLR 2025, 2024. arXiv:2408.08435. https://arxiv.org/abs/2408.08435
  - A meta-agent programs new agent designs and evaluates them; our Coach is a typed, constrained version of this meta-agent, and our Gatekeeper adds paired statistical acceptance.
- **zelikman2023stop**: Self-Taught Optimizer (STOP): Recursively Self-Improving Code Generation. Zelikman, Eric, Lorch, Eliana, Mackey, Lester, Kalai, Adam Tauman. COLM 2024, 2023. arXiv:2310.02304. https://arxiv.org/abs/2310.02304
  - Recursive self-improvement of the scaffold around a fixed LM (the model weights never change), the core framing of our title; STOP also documents sandbox-circumvention attempts, motivating our unfakeable physics reward.
- **yin2024godel**: Gödel Agent: A Self-Referential Agent Framework for Recursive Self-Improvement. Yin, Xunjian, Wang, Xinyi, Pan, Liangming et al.. ACL 2025, 2024. arXiv:2410.04444. https://arxiv.org/abs/2410.04444
  - Self-referential agent that rewrites its own logic; contrast: we restrict edits to a typed genome and require measured paired gain before acceptance.
- **robeyns2025sica**: A Self-Improving Coding Agent. Robeyns, Maxime, Szummer, Martin, Aitchison, Laurence. arXiv preprint, 2025. arXiv:2504.15228. https://arxiv.org/abs/2504.15228
  - Agent edits its own codebase and keeps improvements by benchmark utility; parallel to our genome lineage with an incumbent/challenger loop.
- **zhang2024aflow**: AFlow: Automating Agentic Workflow Generation. Zhang, Jiayi, Xiang, Jinyu, Yu, Zhaoyang et al.. ICLR 2025, 2024. arXiv:2410.10762. https://arxiv.org/abs/2410.10762
  - MCTS over code-represented workflows with execution feedback; shows workflow search lets cheaper models match larger ones, supporting our weak-model thesis.
- **zhuge2024gptswarm**: Language Agents as Optimizable Graphs. Zhuge, Mingchen, Wang, Wenyi, Kirsch, Louis et al.. ICML 2024, 2024. arXiv:2402.16823. https://arxiv.org/abs/2402.16823
  - GPTSwarm optimises both prompts (nodes) and agent connectivity (edges); our team-structure edits (planner on/off, memory brief on/off) are a discrete case of edge optimisation.
- **novikov2025alphaevolve**: AlphaEvolve: A coding agent for scientific and algorithmic discovery. Novikov, Alexander, Vũ, Ngân, Eisenberger, Marvin et al.. arXiv preprint, 2025. arXiv:2506.13131. https://arxiv.org/abs/2506.13131
  - Evolutionary LLM code search gated by automatic evaluators; same principle as ours (only machine-checkable reward drives acceptance).
- **romeraparedes2024funsearch**: Mathematical discoveries from program search with large language models. Romera-Paredes, Barekatain, Novikov et al.. Nature 625:468-475, 2024; doi:10.1038/s41586-023-06924-6. https://www.nature.com/articles/s41586-023-06924-6
  - LLM proposals filtered by an automatic evaluator; the evaluator-not-judge principle our physics reward follows.

## Prompt and program optimisation
- **yang2023opro**: Large Language Models as Optimizers. Yang, Chengrun, Wang, Xuezhi, Lu, Yifeng et al.. ICLR 2024, 2023. arXiv:2309.03409. https://arxiv.org/abs/2309.03409
  - LLM proposes prompts from a scored history of past solutions; our Coach does the same over genome edits using the lineage as the trajectory.
- **fernando2023promptbreeder**: Promptbreeder: Self-Referential Self-Improvement Via Prompt Evolution. Fernando, Chrisantha, Banarse, Dylan, Michalewski, Henryk et al.. arXiv preprint (ICML 2024), 2023. arXiv:2309.16797. https://arxiv.org/abs/2309.16797
  - Evolves task prompts and the mutation prompts themselves; precedent for self-referential prompt evolution, which we extend to tool policy and team structure.
- **guo2023evoprompt**: EvoPrompt: Connecting LLMs with Evolutionary Algorithms Yields Powerful Prompt Optimizers. Guo, Qingyan, Wang, Rui, Guo, Junliang et al.. ICLR 2024, 2023. arXiv:2309.08532. https://arxiv.org/abs/2309.08532
  - LLM-as-mutation-operator inside a GA/DE loop; baseline family for our prompt-level edits.
- **khattab2023dspy**: DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines. Khattab, Omar, Singhvi, Arnav, Maheshwari, Paridhi et al.. ICLR 2024, 2023. arXiv:2310.03714. https://arxiv.org/abs/2310.03714
  - Treats LM pipelines as programs optimised against a metric; conceptual ancestor of a typed, optimisable genome.
- **opsahlong2024mipro**: Optimizing Instructions and Demonstrations for Multi-Stage Language Model Programs. Opsahl-Ong, Krista, Ryan, Michael J., Purtell, Josh et al.. EMNLP 2024, 2024. arXiv:2406.11695. https://arxiv.org/abs/2406.11695
  - MIPRO: optimises instructions and demos per module of a multi-stage program using minibatch evaluation; method we compare our multi-role (Loader/Planner) edit credit assignment against.
- **agrawal2025gepa**: GEPA: Reflective Prompt Evolution Can Outperform Reinforcement Learning. Agrawal, Lakshya A., Tan, Shangyin, Soylu, Dilara et al.. ICLR 2026, 2025. arXiv:2507.19457. https://arxiv.org/abs/2507.19457
  - Natural-language reflection on traces plus Pareto selection beats RL with far fewer rollouts; the Critic-then-Coach reflective loop we borrow.
- **yuksekgonul2024textgrad**: TextGrad: Automatic "Differentiation" via Text. Yuksekgonul, Mert, Bianchi, Federico, Boen, Joseph et al.. arXiv preprint, 2024. arXiv:2406.07496. https://arxiv.org/abs/2406.07496
  - Textual feedback as gradients through a compound system; our Critic's outcome review plays the role of the textual gradient.
- **cheng2024trace**: Trace is the Next AutoDiff: Generative Optimization with Rich Feedback, Execution Traces, and LLMs. Cheng, Ching-An, Nie, Allen, Swaminathan, Adith. NeurIPS 2024, 2024. arXiv:2406.16218. https://arxiv.org/abs/2406.16218
  - OptoPrime optimises workflow parameters from execution traces; analogous to using simulator traces (not just scores) to propose edits.

## Reflection and agent memory
- **shinn2023reflexion**: Reflexion: Language Agents with Verbal Reinforcement Learning. Shinn, Noah, Cassano, Federico, Berman, Edward et al.. NeurIPS 2023, 2023. arXiv:2303.11366. https://arxiv.org/abs/2303.11366
  - Verbal self-reflection stored in episodic memory, no weight updates; our episodic layer and Critic generalise this from per-task retries to cross-task lessons.
- **zhao2023expel**: ExpeL: LLM Agents Are Experiential Learners. Zhao, Andrew, Huang, Daniel, Xu, Quentin et al.. AAAI 2024, 2023. arXiv:2308.10144. https://arxiv.org/abs/2308.10144
  - Extracts natural-language insights from success/failure trajectories and reuses them at test time; our semantic lessons with Bayesian confidence add calibrated retention/retirement of such insights.
- **majumder2023clin**: CLIN: A Continually Learning Language Agent for Rapid Task Adaptation and Generalization. Majumder, Bodhisattwa Prasad, Dalvi Mishra, Bhavana, Jansen, Peter et al.. arXiv preprint, 2023. arXiv:2310.10134. https://arxiv.org/abs/2310.10134
  - Persistent causal-abstraction memory updated across trials and transferred to new tasks/environments, the closest analogue to our held-out task-family transfer of lessons.
- **wang2023voyager**: Voyager: An Open-Ended Embodied Agent with Large Language Models. Wang, Guanzhi, Xie, Yuqi, Jiang, Yunfan et al.. arXiv preprint (TMLR 2024), 2023. arXiv:2305.16291. https://arxiv.org/abs/2305.16291
  - Embodied agent with a growing skill library verified by environment feedback; our procedural memory/playbook is the scaffold-level counterpart.
- **wang2024awm**: Agent Workflow Memory. Wang, Zora Zhiruo, Mao, Jiayuan, Fried, Daniel, Neubig, Graham. arXiv preprint (ICML 2025), 2024. arXiv:2409.07429. https://arxiv.org/abs/2409.07429
  - Induces reusable workflows from past episodes into memory; comparable to promoting lessons into playbook rules.
- **park2023generative**: Generative Agents: Interactive Simulacra of Human Behavior. Park, Joon Sung, O'Brien, Joseph C., Cai, Carrie J. et al.. UIST 2023, 2023. arXiv:2304.03442. https://arxiv.org/abs/2304.03442
  - Memory stream with retrieval and reflection; architectural template for our layered Librarian.
- **packer2023memgpt**: MemGPT: Towards LLMs as Operating Systems. Packer, Charles, Wooders, Sarah, Lin, Kevin et al.. arXiv preprint, 2023. arXiv:2310.08560. https://arxiv.org/abs/2310.08560
  - Tiered memory paging for context-limited models; motivates our compact memory brief for a small-context loader.
- **madaan2023selfrefine**: Self-Refine: Iterative Refinement with Self-Feedback. Madaan, Aman, Tandon, Niket, Gupta, Prakhar et al.. NeurIPS 2023, 2023. arXiv:2303.17651. https://arxiv.org/abs/2303.17651
  - Within-episode self-feedback without external signal; contrast: our feedback comes from physics, not the model's self-assessment.

## Multi-agent systems
- **wu2023autogen**: AutoGen: Enabling Next-Gen LLM Applications via Multi-Agent Conversation. Wu, Qingyun, Bansal, Gagan, Zhang, Jieyu et al.. arXiv preprint (COLM 2024), 2023. arXiv:2308.08155. https://arxiv.org/abs/2308.08155
  - General multi-agent conversation framework; our Critic/Librarian/Coach/Gatekeeper team is a fixed role instance of this pattern.
- **hong2023metagpt**: MetaGPT: Meta Programming for A Multi-Agent Collaborative Framework. Hong, Sirui, Zhuge, Mingchen, Chen, Jiaqi et al.. ICLR 2024, 2023. arXiv:2308.00352. https://arxiv.org/abs/2308.00352
  - Role-specialised agents with SOPs and structured artefacts; precedent for typed hand-offs (our typed genome edits).
- **li2023camel**: CAMEL: Communicative Agents for "Mind" Exploration of Large Language Model Society. Li, Guohao, Hammoud, Hasan Abed Al Kader, Itani, Hani et al.. NeurIPS 2023, 2023. arXiv:2303.17760. https://arxiv.org/abs/2303.17760
  - Role-playing cooperative agents; early role-based multi-agent baseline.
- **qian2023chatdev**: ChatDev: Communicative Agents for Software Development. Qian, Chen, Liu, Wei, Liu, Hongzhang et al.. ACL 2024, 2023. arXiv:2307.07924. https://arxiv.org/abs/2307.07924
  - Waterfall-style multi-agent team; contrast: our team improves its own structure rather than following a fixed process.
- **du2023debate**: Improving Factuality and Reasoning in Language Models through Multiagent Debate. Du, Yilun, Li, Shuang, Torralba, Antonio et al.. arXiv preprint (ICML 2024), 2023. arXiv:2305.14325. https://arxiv.org/abs/2305.14325
  - Multi-agent critique improves reasoning; relevant to whether a Critic role helps, which our planner/critic toggles test directly.
- **li2024moreagents**: More Agents Is All You Need. Li, Junyou, Zhang, Qin, Yu, Yangbin et al.. TMLR, 2024. arXiv:2402.05120. https://arxiv.org/abs/2402.05120
  - Sampling-and-voting scales with agent count; a cheap-compute baseline our structural edits should beat or match.

## Test-time compute and small models
- **brown2024monkeys**: Large Language Monkeys: Scaling Inference Compute with Repeated Sampling. Brown, Bradley, Juravsky, Jordan, Ehrlich, Ryan et al.. arXiv preprint, 2024. arXiv:2407.21787. https://arxiv.org/abs/2407.21787
  - With an automatic verifier, repeated sampling lets weaker models rival stronger ones; our physics simulator is exactly such a verifier.
- **snell2024ttc**: Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters. Snell, Charlie, Lee, Jaehoon, Xu, Kelvin, Kumar, Aviral. arXiv preprint (ICLR 2025), 2024. arXiv:2408.03314. https://arxiv.org/abs/2408.03314
  - Test-time compute can substitute for parameters on many problems; supports improving the system around a small fixed model.
- **nvidia2025nemotron3**: NVIDIA Nemotron 3: Efficient and Open Intelligence. NVIDIA, Blakeman, Aaron, Grattafiori, Aaron et al.. arXiv preprint, 2025. arXiv:2512.20856. https://arxiv.org/abs/2512.20856
  - Technical report of the open-weight Nemotron 3 family (Nano/Super/Ultra) our team runs on.
- **nvidia2025nemotron3nano**: Nemotron 3 Nano: Open, Efficient Mixture-of-Experts Hybrid Mamba-Transformer Model for Agentic Reasoning. NVIDIA. arXiv preprint, 2025. arXiv:2512.20848. https://arxiv.org/abs/2512.20848
  - Nano-size Nemotron 3 model aimed at agentic reasoning; candidate weak loader / cheap team member.
- **nvidia2025nemotronh**: Nemotron-H: A Family of Accurate and Efficient Hybrid Mamba-Transformer Models. NVIDIA, Blakeman, Aaron et al.. arXiv preprint, 2025. arXiv:2504.03624. https://arxiv.org/abs/2504.03624
  - Predecessor hybrid architecture underlying the Nemotron line.
- **nvidia2025nano2**: NVIDIA Nemotron Nano 2: An Accurate and Efficient Hybrid Mamba-Transformer Reasoning Model. NVIDIA, Basant, Aarti et al.. arXiv preprint, 2025. arXiv:2508.14444. https://arxiv.org/abs/2508.14444
  - Small open reasoning model in the same family; alternative cheap loader.

## Evaluation pitfalls and reward hacking
- **zheng2023judge**: Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena. Zheng, Lianmin, Chiang, Wei-Lin, Sheng, Ying et al.. NeurIPS 2023 Datasets and Benchmarks, 2023. arXiv:2306.05685. https://arxiv.org/abs/2306.05685
  - Documents position, verbosity and self-enhancement biases of LLM judges; why we use physics, not LLM-as-judge, for reward.
- **skalse2022rewardhacking**: Defining and Characterizing Reward Hacking. Skalse, Joar, Howe, Nikolaus H. R., Krasheninnikov, Dmitrii, Krueger, David. NeurIPS 2022, 2022. arXiv:2209.13085. https://arxiv.org/abs/2209.13085
  - Formalises when proxy rewards are unhackable; frames our claim that a deterministic simulator outcome is a hard-to-game reward.
- **amodei2016concrete**: Concrete Problems in AI Safety. Amodei, Dario, Olah, Chris, Steinhardt, Jacob et al.. arXiv preprint, 2016. arXiv:1606.06565. https://arxiv.org/abs/1606.06565
  - Classic statement of reward hacking and safe exploration; context for constraining a self-modifying system.
- **manheim2018goodhart**: Categorizing Variants of Goodhart's Law. Manheim, David, Garrabrant, Scott. arXiv preprint, 2018. arXiv:1803.04585. https://arxiv.org/abs/1803.04585
  - Taxonomy of Goodhart failures (regressional, extremal, causal, adversarial); our held-out exam targets regressional/extremal overfitting to validation tasks.
- **krakovna2020specgaming**: Specification gaming: the flip side of AI ingenuity. Krakovna, Uesato, Mikulik et al.. DeepMind blog, 2020. https://deepmind.google/discover/blog/specification-gaming-the-flip-side-of-ai-ingenuity/
  - Catalogue of agents exploiting reward specifications; the failure mode our physical, deterministic reward and held-out exam are designed against.
