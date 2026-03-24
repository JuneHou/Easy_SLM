"""
Search configuration: subreddits, date ranges, keyword groups, and stream definitions.
All constants here are the single source of truth for reproducibility.

Two-stream design
-----------------
Stream 1 – small/local LLM use :  (A) AND (C)
Stream 2 – large/general LLM use: (B) AND (C)

Search strategy
---------------
SEARCH_QUERIES contains one entry per term in GROUP_A (stream 1) and one
per term in GROUP_B (stream 2).  The API is queried with just the anchor
term; GROUP_C is applied as a fast Python substring filter on the returned
text BEFORE writing to CSV.  A record is kept only when its title+body
contains at least one C-group term.

This is functionally equivalent to A∩C / B∩C but uses far fewer API calls:

  Old (cross-product A×C ∪ B×C): 240+ queries
  New (anchor-only + C filter) :  len(A) + len(B) = 24 queries

All runs are idempotent — duplicates are dropped by Reddit ID.
"""

import os

# ── Date window ───────────────────────────────────────────────────────────────
START_DATE = "2023-01-01"
END_DATE   = "2025-12-31"

# ── Target subreddits (separated by stream) ──────────────────────────────────
# Stream 1 is intentionally local/self-hosted focused.
SUBREDDITS_SMALL_LOCAL = ["LocalLLaMA", "LocalLLM", "SelfHosted"]
#
# Stream 2 should NOT search inside local-model communities by default.
# It targets general/cloud LLM discussion spaces.
SUBREDDITS_LARGE_GENERAL = ["ChatGPT", "OpenAI", "ClaudeAI", "LLM", "Gemini"]

# Backward-compatible combined list (used only for global override/default CLI).
SUBREDDITS = sorted(set(SUBREDDITS_SMALL_LOCAL + SUBREDDITS_LARGE_GENERAL))

# ── Output directory (absolute) ───────────────────────────────────────────────
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Stream identifiers ────────────────────────────────────────────────────────
STREAM_SMALL_LOCAL   = "small_local"
STREAM_LARGE_GENERAL = "large_general"

# ── Group A: Small / local model terms  (12 terms) ───────────────────────────
# Pruning rationale:
#   "local ai", "locally run model", "running locally"  → covered by "local llm" / "run locally"
#   "self-hosted ai"                                    → covered by "self-hosted llm"
#   "offline ai", "on-device ai", "on-device model"     → covered by "offline llm" / "on-device llm"
#   "edge model"                                        → covered by "edge ai"
#   "personal ai"                                       → covered by "private ai"
#   "own machine", "on my laptop/pc/desktop/mac/phone"  → collapsed to "on my machine"
#   "open model"                                        → covered by "open-source model"
#   "small model", "lightweight model", "compact model" → covered by "small language model"
GROUP_A: list[str] = [
    "local llm",
    "local model",
    "self-hosted llm",
    "on-device llm",
    "offline llm",
    "run locally",
    "private ai",
    "edge ai",
    "small language model",
    "slm",
    "open-source model",
    "on my machine",
]

# ── Group B: Large / general LLM terms  (12 terms) ───────────────────────────
# Pruning rationale:
#   "llm"             → too generic; matches every post on LocalLLaMA
#   "gpt"             → ambiguous (GPT-2, fine-tuned, etc.)
#   "language model"  → superseded by "large language model"
#   "ai model"        → too generic
#   "chatbot"         → broad, not LLM-specific
#   "remote model", "cloud model", "hosted model" → rare phrasing; "cloud model" kept as representative
GROUP_B: list[str] = [
    "large language model",
    "generative ai",
    "ai assistant",
    "chatgpt",
    "claude",
    "gemini",
    "copilot",
    "perplexity",
    "foundation model",
    "frontier model",
    "genai",
    "cloud model",
]

# ── Group C: Shared use-practice terms  (9 terms) ────────────────────────────
# Pruning rationale:
#   "what do you use it for", "my use case", "use cases" → covered by "what do you use"
#   "how are you using"                                  → covered by "how do you use"
#   "i use mine for"                                     → covered by "i use it for"
#   "workflows", "part of my workflow"                   → covered by "workflow"
#   "daily driver"                                       → covered by "daily use"
#   "actually use", "real use", "practical use"          → collapsed to "in practice"
#   "use for"  REMOVED  – too broad; catches hardware buying posts where someone
#                         lists future intended uses ("I want to buy this to use for X")
#   "use for"  REMOVED  – too broad; catches hardware buying posts where someone
#                         lists future intended uses ("I want to buy this to use for X")
# "use case" is retained: it directly signals a use-case discussion even if the post
# is about hardware setup — the A/B anchor already ensures LLM relevance.
GROUP_C: list[str] = [
    "use case",
    "workflow",
    "what do you use",
    "how do you use",
    "i use it for",
    "daily use",
    "routine",
    "in practice",
    "helps me",
]

# ── Generated search queries ──────────────────────────────────────────────────
# One query per anchor term.  C-group filtering is applied in Python after
# retrieval (see reddit_pipeline._matches_c_group).
SEARCH_QUERIES: list[dict] = [
    *({"query": a, "stream": STREAM_SMALL_LOCAL}   for a in GROUP_A),
    *({"query": b, "stream": STREAM_LARGE_GENERAL} for b in GROUP_B),
]

# ── Label → friendly display name ────────────────────────────────────────────
LABEL_NAMES: dict[str, str] = {
    STREAM_SMALL_LOCAL:   "Small / Local LLM Use",
    STREAM_LARGE_GENERAL: "Large / General LLM Use",
    "unclassified":       "Unclassified",
}

# ── PullPush API ──────────────────────────────────────────────────────────────
PULLPUSH_BASE      = "https://api.pullpush.io/reddit/search"
PULLPUSH_SIZE      = 100         # max results per page
PULLPUSH_SLEEP_SEC = 1.5         # polite delay between requests

# ── Output filenames ──────────────────────────────────────────────────────────
CSV_SUBMISSIONS = "reddit_submissions.csv"
CSV_COMMENTS    = "reddit_comments.csv"
CSV_COMBINED    = "reddit_combined.csv"
STATS_JSON      = "stats.json"
