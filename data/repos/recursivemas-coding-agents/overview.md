<!-- overview-commits: {"deepagents-latent-integration":"90e2fc9ec0cf8822bb6e96946db773288281b15a","main":"27c0e601e94030499a3476903038bb2dd51df461","smoke-test":"858fcd205d423bd80c1898abcd437a7f8c25dfce"} -->

## What RecursiveMAS is (upstream work)

RecursiveMAS is a multi-agent framework for large language models (LLMs) that enables agent collaboration through latent-space recursion. Instead of treating each agent as an isolated module, RecursiveMAS connects heterogeneous agents via lightweight RecursiveLink modules, allowing iterative exchange and refinement of latent states across recursion rounds. The upstream codebase is authored by the RecursiveMAS team and is available at [RecursiveMAS/RecursiveMAS](https://github.com/RecursiveMAS/RecursiveMAS). The foundational paper is ["Scaling agent collaboration through latent-space recursion"](https://arxiv.org/abs/2604.25917).

## What Sachin's research adds

Sachin's current research is on the `deepagents-latent-integration` branch, last commit 2026-09-22, not merged into `main`. The newest recorded result on that branch is Gate 0.1 GREEN on a RunPod RTX 4090. His research extends RecursiveMAS by integrating its latent inter-agent communication into the LangChain Deep Agents coding harness and designing a controlled experimental framework to compare latent delegation with text-based delegation. The additions include:

- **Experiment design and documentation:** Detailed experiment plans and research proposals (`PROPOSAL.md`, `PLAN.md`, and `experiments/exp0-harness-spike.md` through `experiments/exp4-outer-recursive-delegation.md`) specifying research questions, experimental controls, and evaluation metrics for the Deep Agents integration.
- **Deep Agents integration code:** The `integrations/deepagents_latent/` package on `deepagents-latent-integration` (not merged), which implements the sidecar for latent delegation, instrumentation for benchmarking (tokens, latency, compute), tool-calling support in `integrations/deepagents_latent/tool_calling.py`, and a golden multi-file coding task fixture with ground-truth labels for probing. Experiment 4 is `experiments/exp4-outer-recursive-delegation.md` on that same branch.
- **Unit tests and verification:** Tests for instrumentation and tool-calling, and scripts to verify the correctness and reproducibility of the golden task fixture.

These contributions enable rigorous, reproducible experiments on whether latent delegation improves multi-step coding quality and efficiency compared to text delegation, using the same agent topology, tools, and model weights.

## Current work

The most recently committed branch is `deepagents-latent-integration`, with its last commit on 2026-09-22. The latest commit subjects include:

- "Close the venv-path trap in gate0_setup.sh; settle the cos(in,out) width question"
- "Gate 0.1 GREEN on a RunPod RTX 4090; record two infra traps"
- "Generalize the Gate 0.1 setup script to CUDA as well as ROCm"
- "Gate 0.1: ROCm setup script"
- "Gate 0.5: freeze the golden task fixture (verified); note ROCm consequences"
- "Close all six open decisions (PLAN §9)"
- "Seed integrations/deepagents_latent and record verified API facts (PLAN §11)"
- "outer recursion"
- "Proposal"

This branch focuses on environment setup, experiment infrastructure, and the implementation of the Deep Agents latent delegation integration, including reproducibility and benchmarking tools.

## Branches

- **main** (default): Last commit 2026-08-04. This branch tracks the upstream RecursiveMAS codebase and contains an upstream merge commit. It provides the baseline RecursiveMAS framework, training, and inference pipelines.
- **deepagents-latent-integration**: Last commit 2026-09-22, not merged. This is the active research branch. Its newest commits record Gate 0.1 GREEN on a RunPod RTX 4090. The branch also adds the Deep Agents integration, experiment plans, benchmarking instrumentation, and a golden coding task fixture. It is ahead of main by 9 commits and behind by 6.
- **smoke-test**: Last commit 2026-08-04, not merged. This branch adds a different `latent_channel_smoke.ipynb` at the repository root, in a commit titled "Created using Colab". It is separate from `notebooks/latent_channel_smoke.ipynb`.

## Repo layout

- **experiments/**: Experiment plans and protocols for the Deep Agents integration and ablation studies. Exists on all branches, but content is extended on `deepagents-latent-integration`.
- **inference/**: Upstream RecursiveMAS inference pipeline, including model loading, inference utilities, and prompt templates. Present on main and smoke-test.
- **train/**: Upstream RecursiveMAS training pipeline, including inner and outer loop trainers and data utilities. Present on main and smoke-test.
- **notebooks/**: Contains `notebooks/latent_channel_smoke.ipynb` on main, smoke-test, and `deepagents-latent-integration`. `smoke-test` also adds a different `latent_channel_smoke.ipynb` at the repository root.
- **integrations/**: Only on `deepagents-latent-integration`. Contains the Deep Agents latent delegation integration (`deepagents_latent/`), including instrumentation, tool-calling, task fixtures, and tests.
- **requirements.txt, README.md, LICENSE, PROPOSAL.md**: Project-level documentation and configuration on the default branch. `PROPOSAL.md` is revised on `deepagents-latent-integration`. `PLAN.md` is new on that branch and is not on main.

## Key entry points

**Training:**
- `train/train_inner.py` and `train/train_outer.py` (upstream, main, smoke-test): Scripts for inner and outer loop training of RecursiveMAS agents.

**Inference:**
- `inference/run.py` (upstream, main, smoke-test): Main entry point for running inference and evaluating RecursiveMAS agents.
- `inference/inference_utils/inference_mas_mixture.py` (upstream, main, smoke-test): Implements latent rollout and outer link mapping for mixture-style agent collaboration.

**Evaluation:**
- `inference/inference_utils/answer_utils.py`, `inference/inference_utils/llm_judge.py` (upstream, main, smoke-test): Utilities for answer evaluation and LLM-based judging.

**Deep Agents integration:**
- `integrations/deepagents_latent/` (deepagents-latent-integration only):
  - `__init__.py`: Integration entry point.
  - `instrumentation.py`: Benchmarking and compute accounting.
  - `tool_calling.py`: Tool-calling support for local HuggingFace models in Deep Agents.
  - `tasks/golden/`: Golden multi-file coding task fixture and verification scripts.
  - `tests/`: Unit tests for instrumentation and tool-calling.

**Notebooks:**
- `notebooks/latent_channel_smoke.ipynb` (main, smoke-test, and deepagents-latent-integration): Latent channel notebook. `smoke-test` also has a different copy at the repository root.

Upstream entry points are labeled as such above. The Deep Agents integration and its supporting files are new and only present on the `deepagents-latent-integration` branch.
