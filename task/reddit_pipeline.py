#!/usr/bin/env python3
"""
Reddit Search Pipeline
======================
Pulls submissions and comments from Reddit via PullPush
using the two-stream keyword strategy defined in config.py.

Two-stream design
-----------------
Stream 1 – small/local LLM use :  GROUP_A × GROUP_C queries
Stream 2 – large/general LLM use: GROUP_B × GROUP_C queries

Each query is an "<anchor_term> <c_term>" pair, so every retrieved record
is pre-qualified for the A∩C or B∩C condition.

Incremental / safe-to-re-run
-----------------------------
On every run the pipeline:
  1. Loads any records already saved in the output CSVs.
  2. Fetches new records from PullPush.
  3. Merges by Reddit ID — existing records are NEVER overwritten.
  4. Saves the combined result back to disk.

Usage
-----
    python reddit_pipeline.py                          # both streams
    python reddit_pipeline.py --stream 1               # stream 1 only (A×C)
    python reddit_pipeline.py --stream 2               # stream 2 only (B×C)
    python reddit_pipeline.py --start 2024-01-01 --end 2024-12-31
    python reddit_pipeline.py --subreddits-s1 LocalLLaMA LocalLLM SelfHosted
    python reddit_pipeline.py --subreddits-s2 ChatGPT OpenAI ClaudeAI
    python reddit_pipeline.py --subreddits LocalLLaMA LocalLLM   # global override

Output
------
    task/reddit_submissions.csv   – unique posts, merged across all runs
    task/reddit_comments.csv      – unique comments, merged across all runs
    task/reddit_combined.csv      – both merged and sorted by date
    task/stats.json               – counts by month and by stream
"""

import argparse
import csv
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any

import requests

sys.path.insert(0, os.path.dirname(__file__))
import config

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ── helpers ───────────────────────────────────────────────────────────────────

# Pre-compile C-group terms as lowercase for fast membership testing.
_C_TERMS: list[str] = [t.lower() for t in config.GROUP_C]


def _matches_c_group(text: str) -> bool:
    """Return True if *text* contains at least one GROUP_C use-practice term."""
    t = text.lower()
    return any(c in t for c in _C_TERMS)


def _to_epoch(date_str: str) -> int:
    dt = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


def _from_epoch(epoch: int | float) -> str:
    return datetime.fromtimestamp(epoch, tz=timezone.utc).strftime("%Y-%m-%d")


def _get_json(url: str, params: dict, sleep: float) -> dict | None:
    """GET with retry logic for rate-limits and server errors."""
    for attempt in range(1, 5):
        try:
            resp = requests.get(url, params=params, timeout=30)
            if resp.status_code == 200:
                time.sleep(sleep)
                return resp.json()
            if resp.status_code == 429:
                wait = int(resp.headers.get("Retry-After", 60))
                log.warning("Rate-limited — sleeping %ds", wait)
                time.sleep(wait)
            elif resp.status_code >= 500:
                log.warning("Server error %d — retry %d/4", resp.status_code, attempt)
                time.sleep(10 * attempt)
            else:
                try:
                    body = resp.json()
                except Exception:
                    body = resp.text[:200]
                log.error("HTTP %d for %s | params=%s | body=%s",
                          resp.status_code, url, params, body)
                return None
        except requests.RequestException as exc:
            log.warning("Request error (attempt %d/4): %s", attempt, exc)
            time.sleep(5 * attempt)
    return None


# ── CSV merge helpers ─────────────────────────────────────────────────────────

FIELDNAMES = [
    "source", "kind", "id", "subreddit", "date",
    "title", "body", "url", "score", "num_comments",
    "query", "stream", "task_labels",
]


def _load_csv(path: str) -> dict[str, dict]:
    """Load an existing CSV into a {id: row} dict. Returns {} if file missing."""
    existing: dict[str, dict] = {}
    if not os.path.exists(path):
        return existing
    with open(path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            rid = row.get("id", "")
            if rid:
                existing[rid] = row
    log.info("Loaded %d existing records from %s", len(existing), os.path.basename(path))
    return existing


def _write_csv(rows: list[dict], path: str) -> None:
    with open(path, "w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=FIELDNAMES, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    log.info("Saved %d rows → %s", len(rows), path)


def _build_stats(rows: list[dict]) -> dict:
    by_month:  dict[str, int] = {}
    by_stream: dict[str, int] = {}
    by_label:  dict[str, int] = {}
    for row in rows:
        month = row["date"][:7]
        by_month[month] = by_month.get(month, 0) + 1

        stream = row.get("stream", "unclassified")
        by_stream[stream] = by_stream.get(stream, 0) + 1

        for label in row.get("task_labels", "").split("|"):
            if label:
                by_label[label] = by_label.get(label, 0) + 1

    return {
        "total_records": len(rows),
        "by_month":      dict(sorted(by_month.items())),
        "by_stream":     dict(sorted(by_stream.items())),
        "by_label":      dict(sorted(by_label.items(), key=lambda x: -x[1])),
        "stream_names":  config.LABEL_NAMES,
        "query_counts": {
            "stream1_queries": sum(
                1 for q in config.SEARCH_QUERIES
                if q["stream"] == config.STREAM_SMALL_LOCAL
            ),
            "stream2_queries": sum(
                1 for q in config.SEARCH_QUERIES
                if q["stream"] == config.STREAM_LARGE_GENERAL
            ),
        },
    }


# ── PullPush ──────────────────────────────────────────────────────────────────

def _pullpush_search(
    kind: str,
    subreddit: str,
    query: str,
    after: int,
    before: int,
    size: int = config.PULLPUSH_SIZE,
) -> list[dict]:
    url = f"{config.PULLPUSH_BASE}/{kind}/"
    results: list[dict] = []
    params: dict[str, Any] = {
        "subreddit": subreddit,
        "q":         query,
        "after":     after,
        "before":    before,
        "size":      size,
        "sort":      "asc",
    }
    while True:
        data = _get_json(url, params, config.PULLPUSH_SLEEP_SEC)
        if data is None:
            break
        items = data.get("data", [])
        if not items:
            break
        results.extend(items)
        log.info("  PullPush %s  r/%s  q='%s'  +%d (total %d)",
                 kind, subreddit, query, len(items), len(results))
        if len(items) < size:
            break
        params["after"] = items[-1]["created_utc"]
    return results


def collect_pullpush(
    subreddit_map: dict[str, list[str]],
    queries: list[dict],
    start: str,
    end: str,
) -> tuple[dict[str, dict], dict[str, dict]]:
    after  = _to_epoch(start)
    before = _to_epoch(end)
    new_submissions: dict[str, dict] = {}
    new_comments:    dict[str, dict] = {}

    for entry in queries:
        q      = entry["query"]
        stream = entry["stream"]
        subreddits = subreddit_map.get(stream, [])
        for sub in subreddits:
            log.info("PullPush submissions | r/%s | stream=%s | '%s'", sub, stream, q)
            raw_subs = _pullpush_search("submission", sub, q, after, before)
            kept_subs = 0
            for item in raw_subs:
                pid   = item.get("id", "")
                title = item.get("title", "")
                body  = item.get("selftext", "")
                if not _matches_c_group(f"{title} {body}"):
                    continue                          # C-group filter
                kept_subs += 1
                row = {
                    "source":       "pullpush",
                    "kind":         "submission",
                    "id":           pid,
                    "subreddit":    item.get("subreddit", sub),
                    "date":         _from_epoch(item.get("created_utc", 0)),
                    "title":        title,
                    "body":         body[:2000],
                    "url":          f"https://reddit.com{item.get('permalink', '')}",
                    "score":        item.get("score", 0),
                    "num_comments": item.get("num_comments", 0),
                    "query":        q,
                    "stream":       stream,
                    "task_labels":  stream,
                }
                new_submissions.setdefault(pid, row)
            log.info("  → kept %d / %d submissions after C-group filter", kept_subs, len(raw_subs))

            log.info("PullPush comments   | r/%s | stream=%s | '%s'", sub, stream, q)
            raw_coms = _pullpush_search("comment", sub, q, after, before)
            kept_coms = 0
            for item in raw_coms:
                cid  = item.get("id", "")
                body = item.get("body", "")
                if not _matches_c_group(body):
                    continue                          # C-group filter
                kept_coms += 1
                row = {
                    "source":       "pullpush",
                    "kind":         "comment",
                    "id":           cid,
                    "subreddit":    item.get("subreddit", sub),
                    "date":         _from_epoch(item.get("created_utc", 0)),
                    "title":        "",
                    "body":         body[:2000],
                    "url":          f"https://reddit.com{item.get('permalink', '')}",
                    "score":        item.get("score", 0),
                    "num_comments": "",
                    "query":        q,
                    "stream":       stream,
                    "task_labels":  stream,
                }
                new_comments.setdefault(cid, row)
            log.info("  → kept %d / %d comments after C-group filter", kept_coms, len(raw_coms))

    return new_submissions, new_comments


# ── CLI ───────────────────────────────────────────────────────────────────────

def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description=(
            "Reproducible two-stream Reddit search pipeline (PullPush).\n"
            "Stream 1 (A×C): small/local LLM use  |  Stream 2 (B×C): large/general LLM use"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument("--stream", choices=["1", "2", "both"], default="both",
                   help=(
                       "Which query stream to run: "
                       "1 = small/local (A×C), "
                       "2 = large/general (B×C), "
                       "both = all queries (default)"
                   ))
    p.add_argument("--start",  default=config.START_DATE,
                   help=f"Start date YYYY-MM-DD (default: {config.START_DATE})")
    p.add_argument("--end",    default=config.END_DATE,
                   help=f"End date YYYY-MM-DD (default: {config.END_DATE})")
    p.add_argument("--subreddits", nargs="+", default=None,
                   help="Global subreddit override for all selected streams")
    p.add_argument("--subreddits-s1", nargs="+", default=None,
                   help="Stream 1 subreddit override (small/local)")
    p.add_argument("--subreddits-s2", nargs="+", default=None,
                   help="Stream 2 subreddit override (large/general)")
    p.add_argument("--out", default=config.OUTPUT_DIR,
                   help="Output directory (default: same folder as this script)")
    return p


# ── main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    args = build_arg_parser().parse_args()
    os.makedirs(args.out, exist_ok=True)

    stream_filter = {
        "1":    {config.STREAM_SMALL_LOCAL},
        "2":    {config.STREAM_LARGE_GENERAL},
        "both": {config.STREAM_SMALL_LOCAL, config.STREAM_LARGE_GENERAL},
    }[args.stream]

    queries = [q for q in config.SEARCH_QUERIES if q["stream"] in stream_filter]
    n_s1 = sum(1 for q in queries if q["stream"] == config.STREAM_SMALL_LOCAL)
    n_s2 = sum(1 for q in queries if q["stream"] == config.STREAM_LARGE_GENERAL)

    # Resolve per-stream subreddit scopes.
    subreddit_map: dict[str, list[str]] = {
        config.STREAM_SMALL_LOCAL: list(config.SUBREDDITS_SMALL_LOCAL),
        config.STREAM_LARGE_GENERAL: list(config.SUBREDDITS_LARGE_GENERAL),
    }
    if args.subreddits:
        subreddit_map[config.STREAM_SMALL_LOCAL] = list(args.subreddits)
        subreddit_map[config.STREAM_LARGE_GENERAL] = list(args.subreddits)
    if args.subreddits_s1:
        subreddit_map[config.STREAM_SMALL_LOCAL] = list(args.subreddits_s1)
    if args.subreddits_s2:
        subreddit_map[config.STREAM_LARGE_GENERAL] = list(args.subreddits_s2)

    # Keep only selected streams.
    subreddit_map = {k: v for k, v in subreddit_map.items() if k in stream_filter}

    sub_path  = os.path.join(args.out, config.CSV_SUBMISSIONS)
    com_path  = os.path.join(args.out, config.CSV_COMMENTS)
    comb_path = os.path.join(args.out, config.CSV_COMBINED)

    # ── Step 1: load whatever is already on disk ──────────────────────────────
    all_submissions = _load_csv(sub_path)
    all_comments    = _load_csv(com_path)
    before_subs = len(all_submissions)
    before_coms = len(all_comments)

    log.info("=== Reddit Search Pipeline (PullPush, two-stream) ===")
    log.info("Stream     : %s  (stream1=%d queries, stream2=%d queries)",
             args.stream, n_s1, n_s2)
    log.info("Date range : %s → %s", args.start, args.end)
    log.info("Subreddits by stream:")
    for stream_key, subs in subreddit_map.items():
        log.info("  %s: %s", stream_key, subs)
    log.info("Total queries selected: %d", len(queries))
    log.info("Output dir : %s", args.out)
    log.info("Existing   : %d submissions, %d comments (will merge)", before_subs, before_coms)

    # ── Step 2: fetch new records ─────────────────────────────────────────────
    log.info("── PullPush pass ──────────────────────────────────")
    new_subs, new_coms = collect_pullpush(
        subreddit_map, queries, args.start, args.end
    )
    for rid, row in new_subs.items():
        all_submissions.setdefault(rid, row)
    for rid, row in new_coms.items():
        all_comments.setdefault(rid, row)

    # ── Step 3: report what was added ─────────────────────────────────────────
    added_subs = len(all_submissions) - before_subs
    added_coms = len(all_comments)    - before_coms
    log.info("New records fetched: +%d submissions, +%d comments", added_subs, added_coms)

    # ── Step 4: write merged results ──────────────────────────────────────────
    submission_rows = sorted(all_submissions.values(), key=lambda r: r["date"])
    comment_rows    = sorted(all_comments.values(),    key=lambda r: r["date"])
    combined_rows   = sorted(submission_rows + comment_rows, key=lambda r: r["date"])

    _write_csv(submission_rows, sub_path)
    _write_csv(comment_rows,    com_path)
    _write_csv(combined_rows,   comb_path)

    stats = _build_stats(combined_rows)
    stats_path = os.path.join(args.out, config.STATS_JSON)
    with open(stats_path, "w", encoding="utf-8") as fh:
        json.dump(stats, fh, indent=2)
    log.info("Stats → %s", stats_path)

    log.info("=== Done ===")
    log.info("Unique submissions : %d", len(submission_rows))
    log.info("Unique comments    : %d", len(comment_rows))
    log.info("Total records      : %d", stats["total_records"])
    log.info("By stream:")
    for stream, count in stats["by_stream"].items():
        friendly = config.LABEL_NAMES.get(stream, stream)
        log.info("  %-30s %d", friendly, count)


if __name__ == "__main__":
    main()
