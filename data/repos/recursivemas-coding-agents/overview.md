<!-- overview-commits: {"deepagents-latent-integration":"332c0898864caec8809a98dd0001e8a952205e96","main":"27c0e601e94030499a3476903038bb2dd51df461","smoke-test":"858fcd205d423bd80c1898abcd437a7f8c25dfce"} -->

## What RecursiveMAS is (upstream work)

RecursiveMAS is a multi-agent framework for large language models (LLMs) that enables agent collaboration through latent-space recursion. Instead of treating each agent as an isolated module, RecursiveMAS models the entire multi-agent system as a unified recursive computation, connecting heterogeneous agents via lightweight RecursiveLink modules. These modules allow agents to iteratively exchange, refine, and evolve their latent states across recursion rounds. The framework supports various collaboration patterns (sequential, mixture, deliberation, distillation) and provides pipelines for training, inference, and evaluation. The upstream code and paper are authored by the RecursiveMAS team and are available at [RecursiveMAS/RecursiveMAS](https://github.com/RecursiveMAS/RecursiveMAS). The main paper is linked at [https://arxiv.org/abs/2604.25917](https://arxiv.org/abs/2604.25917).

## What Sachin's research adds

Sachin's research extends RecursiveMAS by designing and implementing a controlled integration of RecursiveMAS latent inter-agent communication into the [LangChain Deep Agents](https://github.com/langchain-ai/deepagents) coding harness. This work introduces:

- A detailed research proposal (`PROPOSAL.md`) and engineering plan (`PLAN.md`) for evaluating latent vs. text-based delegation in coding agents.
- Experiment protocols and plans for a series of controlled studies (`experiments/exp0-harness-spike.md`, `exp1-controlled-channel-ablation.md`, `exp2-capacity-sweep.md`, `exp3a-delegation-boundary-probes.md`, `exp3b-operational-observability.md`, `exp4-outer-recursive-delegation.md`).
- A new integration package (`integrations/deepagents_latent/`) that provides the code and instrumentation for Deep Agents to use RecursiveMAS latent delegation, including benchmarking utilities, tool-calling support, and a golden multi-file coding task fixture with ground-truth labels for probing.
- Unit tests and scripts to verify the integration and environment setup.

All these additions are attributed to Sachin and are present only on the `deepagents-latent-integration` branch.

## Current work

The most recently committed branch is `deepagents-latent-integration`, with its last commit on 2026-10-03. The latest commit subject is "Add a one-line marker to PLAN.md to exercise the branch-diff workflow," which is a harmless content change to verify branch-diff tooling. The branch contains the full Deep Agents integration plan, experiment protocols, integration code, and supporting test and task fixtures.

## Branches

- **main** (default branch): Last commit 2026-08-04. This branch tracks upstream RecursiveMAS and contains the merged upstream codebase, including the core training, inference, and evaluation pipelines. It includes an upstream merge commit and serves as the baseline for all work.
- **deepagents-latent-integration**: Last commit 2026-10-03, not merged. This branch is ahead by 10 commits and behind by 6. It adds Sachin's research plan, experiment protocols, and the full Deep Agents latent integration package, including code, tests, and a golden coding task fixture. It is the active branch for the Deep Agents integration and experiment design.
- **smoke-test**: Last commit 2026-08-04, not merged. This branch is ahead by 1 commit and contains a notebook (`latent_channel_smoke.ipynb`) for running a smoke test of the latent channel, used for quick validation of the latent delegation mechanism.

## Repo layout

- **experiments/**: Contains experiment protocols and plans. On `deepagents-latent-integration`, these are extended with detailed experiment designs for the Deep Agents integration.
- **inference/** (main, smoke-test): Upstream inference pipeline, utilities, and model loading.
- **inference_utils/** (deepagents-latent-integration): Upstream inference utilities, present at the top level on this branch.
- **integrations/deepagents_latent/** (deepagents-latent-integration only): Sachin's Deep Agents integration package, including instrumentation, tool-calling, test fixtures, and a golden coding task.
- **notebooks/**: Contains the upstream latent channel smoke test notebook.
- **train/**: Upstream training pipeline, including inner/outer loop trainers and data utilities.
- **latent_channel_smoke.ipynb**: On `smoke-test`, a standalone notebook for latent channel validation.
- **README.md, requirements.txt, PROPOSAL.md, PLAN.md**: Project documentation and research plans. 

## Key entry points

**Training:**
- `train/train_inner.py` (main, smoke-test, upstream): Inner-loop training for agent-specific adapters.
- `train/train_outer.py` (main, smoke-test, upstream): Outer-loop training for RecursiveLink modules.

**Inference:**
- `inference/run.py` (main, smoke-test, upstream): Main entry point for running inference and evaluation.
- `inference/inference_utils/inference_mas_mixture.py` (main, smoke-test, upstream): Implements latent rollout and outer adapter logic for mixture-style systems.

**Evaluation:**
- `inference/inference_utils/answer_utils.py` (main, smoke-test, upstream): Utilities for answer extraction and evaluation.
- `inference/inference_utils/llm_judge.py` (main, smoke-test, upstream): LLM-based evaluation for open-ended tasks.

**Deep Agents integration:**
- `integrations/deepagents_latent/__init__.py` (deepagents-latent-integration): Entry point for the Deep Agents latent delegation integration.
- `integrations/deepagents_latent/instrumentation.py` (deepagents-latent-integration): Benchmarking and compute accounting for arm comparisons.
- `integrations/deepagents_latent/tool_calling.py` (deepagents-latent-integration): Tool-calling support for local Hugging Face models in Deep Agents.
- `integrations/deepagents_latent/tasks/golden/verify_fixture.py` (deepagents-latent-integration): Verifies the golden coding task fixture for experiment reproducibility.

**Notebooks:**
- `notebooks/latent_channel_smoke.ipynb` (all branches): Upstream smoke test for latent channel validation.
- `latent_channel_smoke.ipynb` (smoke-test): Standalone version for quick validation.

Upstream entry points are labeled as such above. Paths under `integrations/deepagents_latent/` are new and specific to Sachin's Deep Agents integration, present only on the `deepagents-latent-integration` branch.
