"""PR / diff review tools (CubOS-shaped, inspired by pr-agent).

Each function takes a unified-diff string (e.g. from `git diff`) and returns
a structured analysis. Uses the unified `ai_client.ask_ai` provider.
"""
from .reviewer import pr_describe, pr_review, pr_improve, pr_ask, run_pr_op

__all__ = ["pr_describe", "pr_review", "pr_improve", "pr_ask", "run_pr_op"]
