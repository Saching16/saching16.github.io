<!-- overview-commits: {"deepagents-latent-integration":"332c0898864caec8809a98dd0001e8a952205e96","main":"27c0e601e94030499a3476903038bb2dd51df461","smoke-test":"858fcd205d423bd80c1898abcd437a7f8c25dfce"} -->

## What RecursiveMAS is (upstream work)

RecursiveMAS is a multi-agent framework for large language models (LLMs) that enables agent collaboration through latent-space recursion. Instead of treating each agent as an isolated module, RecursiveMAS connects heterogeneous agents via lightweight RecursiveLink modules, allowing iterative exchange and refinement of latent states across recursion rounds. The upstream codebase is maintained by the RecursiveMAS authors at [RecursiveMAS/RecursiveMAS](https://github.com/RecursiveMAS/RecursiveMAS). The foundational paper is ["Scaling agent collaboration through latent-space recursion"](https://arxiv.org/abs/2604.25917).

## What Sachin's research adds

Sachin's research extends RecursiveMAS by designing, documenting, and implementing a controlled integration of RecursiveMAS latent delegation into the Deep Agents coding harness. This work is organized in the `deepagents-latent-integration` branch and includes:

- **Research planning and experiment design:**  
  - `PLAN.md`: Engineering checklist and environment verification for Deep Agents integration.
  - `PROPOSAL.md`: Research proposal mapping claims, experiment plans, and integration strategy.
  - `experiments/exp0-harness-spike.md` through `experiments/exp4-outer-recursive-delegation.md`: Detailed experiment protocols for evaluating latent vs. text delegation, capacity sweeps, probing, observability, and recursive feedback.
- **Integration code and instrumentation:**  
  - `integrations/deepagents_latent/`: Sidecar package for Deep Agents integration, including:
    - `instrumentation.py`: Token, latency, and compute accounting for arm comparison.
    - `tool_calling.py`: Tool-call plumbing for local HuggingFace models in Deep Agents.
    - `scripts/gate0_setup.sh`: Environment setup script for CUDA/ROCm.
    - `tasks/golden/`: Hand-written golden coding task fixture with ground-truth labels and tests.
    - `tests/`: Unit tests for instrumentation and tool-calling logic.
- **Notebooks and documentation:**  
  - `notebooks/latent_channel_smoke.ipynb`: Diagnostic notebook for latent channel smoke testing.

These additions enable rigorous, reproducible experiments comparing latent and text-based delegation in real coding agent workflows.

## Current work

The most recently committed branch is `deepagents-latent-integration`, with its last commit on 2026-10-03. The latest commit subject is "Add a one-line marker to PLAN.md to exercise the branch-diff workflow," which is a harmless no-op content change used to verify the branch-diff workflow. The branch contains the full integration plan, experiment protocols, Deep Agents sidecar code, and golden task fixture, supporting the planned latent delegation experiments.

## Branches

- **main** (default): Last commit 2026-08-04. This branch tracks the upstream RecursiveMAS codebase and contains Sachin's initial research proposal and experiment plans. It includes an upstream merge commit and serves as the baseline for all development.
- **deepagents-latent-integration**: Last commit 2026-10-03, not merged. This branch adds the Deep Agents integration, experiment protocols, instrumentation, and golden task fixture. It is ahead of main by 10 commits and behind by 6, and is the active branch for current research and development.
- **smoke-test**: Last commit 2026-08-04, not merged. This branch adds a single notebook (`latent_channel_smoke.ipynb`) for smoke testing the latent channel, providing a minimal diagnostic for verifying latent delegation mechanics.

## Repo layout

- **experiments/**: Experiment protocols and plans for latent delegation studies. Present on all branches, but extended with new and revised experiment files on `deepagents-latent-integration`.
- **inference/**: Upstream RecursiveMAS inference pipeline, including model loading, rollout, and evaluation utilities. Present on `main` and `smoke-test`.
- **inference_utils/**: Upstream inference utilities, present as a top-level folder only on `deepagents-latent-integration`.
- **integrations/deepagents_latent/**: Deep Agents integration package, including instrumentation, tool-calling, setup scripts, golden task fixture, and tests. Exists only on `deepagents-latent-integration`.
- **notebooks/**: Diagnostic and demonstration notebooks. 
- **train/**: Upstream RecursiveMAS training pipeline, including data, model, and outer/inner loop trainers. Present on `main` and `smoke-test`.
- **README.md**: Project overview and usage instructions. Present on all branches, with minor upstream variations.
- **requirements.txt**: Python dependencies. Present on all branches.

## Key entry points

**Training:**
- `train/train_inner.py` and `train/train_outer.py` (main, smoke-test; upstream): Entry points for RecursiveMAS inner and outer loop training.

**Inference:**
- `inference/run.py` (main, smoke-test; upstream): Main script for running inference and evaluation.
- `inference/inference_utils/inference_mas_mixture.py` (main, smoke-test; upstream): Core latent rollout and outer link mapping for mixture-style agent graphs.

**Evaluation:**
- `inference/inference_utils/answer_utils.py` (main, smoke-test; upstream): Utilities for answer extraction and evaluation.
- `inference/inference_utils/llm_judge.py` (main, smoke-test; upstream): LLM-based judge for free-form QA evaluation.

**Deep Agents integration:**
- `integrations/deepagents_latent/` (deepagents-latent-integration):  
  - `instrumentation.py`: Compute and token accounting for arm comparison.
  - `tool_calling.py`: Tool-call handling for local HuggingFace models.
  - `tasks/golden/`: Golden coding task fixture for controlled experiments.
  - `scripts/gate0_setup.sh`: Environment setup for CUDA/ROCm.
  - `tests/`: Unit tests for integration logic.

**Notebooks:**
- `notebooks/latent_channel_smoke.ipynb` (all branches): Diagnostic notebook for latent channel smoke testing.
- `latent_channel_smoke.ipynb` (smoke-test): Standalone copy for quick validation.

Upstream entry points are labeled above. The Deep Agents integration code and experiment protocols are unique to the `deepagents-latent-integration` branch.
