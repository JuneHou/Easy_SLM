#!/usr/bin/env python3
"""
Two-Step Pipeline Runner
========================

  Step 1  search    – Collect Reddit posts/comments via PullPush.
  Step 2  annotate  – Classify tasks with GPT using the OpenAI Batch API.

Running step 1 first gives you the exact record count, enabling a precise
per-model cost estimate before you commit any API spend.

Workflow
--------
  Step 1  (search)
    └─ Queries PullPush with two-stream keyword strategy (A×C / B×C).
    └─ Writes: reddit_submissions.csv, reddit_comments.csv, reddit_combined.csv

  [estimate checkpoint]
    └─ Reads the CSV row count and prints a cost comparison table for all
       available models, so you can choose wisely before paying.

  Step 2  (annotate)
    └─ Uploads batch JSONL to OpenAI, polls until done, merges results.
    └─ Writes: reddit_annotated.csv

Usage
-----
  # Full pipeline: search → cost table → confirm model → annotate
  python run.py

  # Step 1 only (collect data, then check cost later)
  python run.py --step search
  python run.py --step search --stream 1 --start 2024-01-01 --end 2024-12-31
  python run.py --step search --subreddits-s1 LocalLLaMA LocalLLM SelfHosted
  python run.py --step search --subreddits-s2 ChatGPT OpenAI ClaudeAI

  # Cost estimate only (reads existing reddit_combined.csv, no API calls)
  python run.py --step estimate

  # Step 2 only (annotate stream-specific CSV)
  python run.py --step annotate --stream 1 --model gpt-4.1
  python run.py --step annotate --stream 2 --model gpt-4.1
  python run.py --step annotate --model gpt-4.1-mini   # cheap pilot run
  python run.py --step annotate --incremental           # skip already-done rows
  python run.py --step annotate --resume                # resume in-progress batch
  python run.py --step annotate --merge-only            # merge downloaded results

Available models (--model)
--------------------------
  gpt-4.1       ← default; newer & cheaper than gpt-4o
  gpt-5 / gpt-5.1  more capable; competitive price on input
  gpt-4o        original; 25 % pricier than gpt-4.1 for same quality
  gpt-4.1-mini  5× cheaper; good for pilot/quality checks
  gpt-4o-mini   cheapest; use for scale tests
"""

import argparse
import os
import sys

# ── import pipeline modules ───────────────────────────────────────────────────
TASK_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, TASK_DIR)

import reddit_pipeline   # noqa: E402
import annotate_batch    # noqa: E402
import config            # noqa: E402


# ── filename helpers ───────────────────────────────────────────────────────────
def _stream_suffix(stream: str) -> str:
    return {"1": "_stream1", "2": "_stream2"}.get(stream, "")


def _with_suffix(filename: str, suffix: str) -> str:
    if not suffix:
        return filename
    root, ext = os.path.splitext(filename)
    return f"{root}{suffix}{ext}"


def _resolve_annotation_paths(stream: str, input_csv: str, out_csv: str) -> tuple[str, str]:
    """Resolve stream-specific annotation defaults from --stream."""
    if stream == "1":
        if input_csv == annotate_batch.DEFAULT_IN:
            input_csv = annotate_batch.DEFAULT_IN_S1
        if out_csv == annotate_batch.DEFAULT_OUT:
            out_csv = annotate_batch.DEFAULT_OUT_S1
    elif stream == "2":
        if input_csv == annotate_batch.DEFAULT_IN:
            input_csv = annotate_batch.DEFAULT_IN_S2
        if out_csv == annotate_batch.DEFAULT_OUT:
            out_csv = annotate_batch.DEFAULT_OUT_S2
    return input_csv, out_csv


# ── CLI ───────────────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Two-step LLM task discovery pipeline (search → annotate)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument(
        "--step",
        choices=["search", "estimate", "annotate", "all"],
        default="all",
        help=(
            "Pipeline step to run: "
            "search = Step 1 only, "
            "estimate = cost table only, "
            "annotate = Step 2 only, "
            "all = search + estimate + annotate (default)"
        ),
    )

    # ── Step 1 args (passed to reddit_pipeline) ───────────────────────────────
    s1 = p.add_argument_group("Step 1 — search options")
    s1.add_argument("--stream", choices=["1", "2", "both"], default="both",
                    help="Query stream: 1=small/local (A×C), 2=large/general (B×C), both (default)")
    s1.add_argument("--start",  default=config.START_DATE,
                    help=f"Start date YYYY-MM-DD (default: {config.START_DATE})")
    s1.add_argument("--end",    default=config.END_DATE,
                    help=f"End date YYYY-MM-DD (default: {config.END_DATE})")
    s1.add_argument("--subreddits", nargs="+", default=None,
                    help="Global subreddit override for all selected streams")
    s1.add_argument("--subreddits-s1", nargs="+", default=None,
                    help="Stream 1 subreddit override (small/local)")
    s1.add_argument("--subreddits-s2", nargs="+", default=None,
                    help="Stream 2 subreddit override (large/general)")
    s1.add_argument("--out-dir", default=config.OUTPUT_DIR,
                    help="Output directory for CSVs (default: task/ folder)")

    # ── Step 2 args (passed to annotate_batch) ────────────────────────────────
    s2 = p.add_argument_group("Step 2 — annotate options")
    s2.add_argument("--model",       default=annotate_batch.DEFAULT_MODEL,
                    choices=list(annotate_batch.BATCH_PRICING),
                    help=f"OpenAI model (default: {annotate_batch.DEFAULT_MODEL})")
    s2.add_argument("--input",       default=annotate_batch.DEFAULT_IN,
                    help=f"Input CSV for annotation (default: {annotate_batch.DEFAULT_IN})")
    s2.add_argument("--annotated-out", default=annotate_batch.DEFAULT_OUT,
                    help=f"Annotated output CSV (default: {annotate_batch.DEFAULT_OUT})")
    s2.add_argument("--incremental", action="store_true",
                    help="Skip rows already present in the annotated output CSV")
    s2.add_argument("--resume",      action="store_true",
                    help="Resume an in-progress batch (skip upload+submit)")
    s2.add_argument("--merge-only",  action="store_true",
                    help="Skip API calls — merge already-downloaded batch_output.jsonl")
    s2.add_argument("--poll-interval", type=int, default=60,
                    help="Seconds between batch status checks (default: 60)")

    return p


# ── step implementations ──────────────────────────────────────────────────────

def run_search(args: argparse.Namespace) -> None:
    """Step 1: run PullPush collection."""
    print()
    print("═" * 60)
    print("  STEP 1 — Reddit Search  (PullPush, two-stream)")
    print("═" * 60)

    stream_filter = {
        "1":    {config.STREAM_SMALL_LOCAL},
        "2":    {config.STREAM_LARGE_GENERAL},
        "both": {config.STREAM_SMALL_LOCAL, config.STREAM_LARGE_GENERAL},
    }[args.stream]
    queries = [q for q in config.SEARCH_QUERIES if q["stream"] in stream_filter]

    n_s1 = sum(1 for q in queries if q["stream"] == config.STREAM_SMALL_LOCAL)
    n_s2 = sum(1 for q in queries if q["stream"] == config.STREAM_LARGE_GENERAL)

    import json, csv
    os.makedirs(args.out_dir, exist_ok=True)

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
    subreddit_map = {k: v for k, v in subreddit_map.items() if k in stream_filter}

    suffix = _stream_suffix(args.stream)
    sub_path  = os.path.join(args.out_dir, _with_suffix(config.CSV_SUBMISSIONS, suffix))
    com_path  = os.path.join(args.out_dir, _with_suffix(config.CSV_COMMENTS, suffix))
    comb_path = os.path.join(args.out_dir, _with_suffix(config.CSV_COMBINED, suffix))

    all_submissions = reddit_pipeline._load_csv(sub_path)
    all_comments    = reddit_pipeline._load_csv(com_path)
    before_subs = len(all_submissions)
    before_coms = len(all_comments)

    import logging
    log = logging.getLogger(__name__)
    log.info("Stream     : %s  (stream1=%d queries, stream2=%d queries)",
             args.stream, n_s1, n_s2)
    log.info("Date range : %s → %s", args.start, args.end)
    log.info("Subreddits by stream:")
    for stream_key, subs in subreddit_map.items():
        log.info("  %s: %s", stream_key, subs)
    log.info("Total queries: %d", len(queries))

    new_subs, new_coms = reddit_pipeline.collect_pullpush(
        subreddit_map, queries, args.start, args.end
    )
    for rid, row in new_subs.items():
        all_submissions.setdefault(rid, row)
    for rid, row in new_coms.items():
        all_comments.setdefault(rid, row)

    added_subs = len(all_submissions) - before_subs
    added_coms = len(all_comments)    - before_coms
    log.info("New records: +%d submissions, +%d comments", added_subs, added_coms)

    submission_rows = sorted(all_submissions.values(), key=lambda r: r["date"])
    comment_rows    = sorted(all_comments.values(),    key=lambda r: r["date"])
    combined_rows   = sorted(submission_rows + comment_rows, key=lambda r: r["date"])

    reddit_pipeline._write_csv(submission_rows, sub_path)
    reddit_pipeline._write_csv(comment_rows,    com_path)
    reddit_pipeline._write_csv(combined_rows,   comb_path)

    stats = reddit_pipeline._build_stats(combined_rows)
    stats_path = os.path.join(args.out_dir, _with_suffix(config.STATS_JSON, suffix))
    with open(stats_path, "w", encoding="utf-8") as fh:
        json.dump(stats, fh, indent=2)

    print()
    print("  Search complete")
    print(f"  Submissions : {len(submission_rows):,}")
    print(f"  Comments    : {len(comment_rows):,}")
    print(f"  Total       : {len(combined_rows):,}  records in {os.path.basename(comb_path)}")
    print()


def run_estimate(input_csv: str, annotated_csv: str) -> None:
    """Estimate checkpoint: print cost table then return."""
    annotate_batch.cost_table(input_csv, annotated_csv)


def run_annotate(args: argparse.Namespace) -> None:
    """Step 2: annotate with OpenAI Batch API."""
    print()
    print("═" * 60)
    print(f"  STEP 2 — Annotation  (model: {args.model})")
    print("═" * 60)
    print()

    # Resolve stream-specific default IO paths for annotation.
    input_csv, out_csv = _resolve_annotation_paths(args.stream, args.input, args.annotated_out)

    # ── merge-only shortcut ───────────────────────────────────────────────────
    if args.merge_only:
        if not os.path.exists(annotate_batch.RESULT_JSONL):
            print(f"[error] No result file found: {annotate_batch.RESULT_JSONL}")
            sys.exit(1)
        annotate_batch.merge_annotations(
            input_csv, annotate_batch.RESULT_JSONL, out_csv
        )
        return

    # ── prepare ───────────────────────────────────────────────────────────────
    if not args.resume:
        requests = annotate_batch.prepare(
            input_csv, args.incremental, args.model, out_csv
        )
        if not requests:
            print("Nothing to annotate — all records already done.")
            return

        ci, co = annotate_batch.BATCH_PRICING[args.model]
        input_tok, output_tok, cost = annotate_batch.cost_estimate(requests, args.model)

        print(f"  Model          : {args.model}  (${ci}/1M in, ${co}/1M out  batch)")
        print(f"  Requests       : {len(requests):,}")
        print(f"  Input tokens   : ~{input_tok:,}")
        print(f"  Output tokens  : ~{output_tok:,}  (est. 200/rec; ceiling {annotate_batch.MAX_OUTPUT_TOKENS})")
        print(f"  Estimated cost : ~${cost:.2f}")

    # ── OpenAI client (needed for sample test + batch) ────────────────────────
    try:
        from openai import OpenAI
    except ImportError:
        print("[error] openai not installed. Run: pip install openai")
        sys.exit(1)

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("[error] OPENAI_API_KEY environment variable not set.")
        sys.exit(1)
    client = OpenAI(api_key=api_key)

    # ── sample test + full-batch confirmation ─────────────────────────────────
    if not args.resume:
        if not annotate_batch.run_sample_test(client, requests, args.model):
            print("[error] Sample test failed — fix the issue before submitting.")
            sys.exit(1)

        answer = input(
            f"\nSample OK. Proceed with full batch: {len(requests):,} requests"
            f" on {args.model} (~${cost:.2f})? [y/N] "
        ).strip().lower()
        if answer != "y":
            print("Aborted.")
            return

        annotate_batch.write_batch_jsonl(requests, annotate_batch.BATCH_JSONL)

    if args.resume:
        if not os.path.exists(annotate_batch.STATE_FILE):
            print(f"[error] No state file: {annotate_batch.STATE_FILE}")
            sys.exit(1)
        state    = annotate_batch.load_state()
        batch_id = state["batch_id"]
        print(f"  Resuming batch_id={batch_id}")
    else:
        file_id  = annotate_batch.upload_file(client, annotate_batch.BATCH_JSONL)
        batch_id = annotate_batch.submit_batch(client, file_id)
        annotate_batch.save_state(file_id, batch_id)

    output_file_id = annotate_batch.poll_batch(client, batch_id, args.poll_interval)
    annotate_batch.download_results(client, output_file_id, annotate_batch.RESULT_JSONL)
    annotate_batch.merge_annotations(input_csv, annotate_batch.RESULT_JSONL, out_csv)

    print()
    print("  Annotation complete.")
    print(f"  Input : {input_csv}")
    print(f"  Output: {out_csv}")


# ── main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    args = build_parser().parse_args()

    step = args.step

    if step in ("search", "all"):
        run_search(args)

    if step in ("estimate", "all"):
        est_in, est_out = _resolve_annotation_paths(args.stream, args.input, args.annotated_out)
        run_estimate(est_in, est_out)

    if step == "all":
        # After seeing the cost table, let the user pick the model interactively
        available = list(annotate_batch.BATCH_PRICING.keys())
        print(f"Available models: {', '.join(available)}")
        choice = input(
            f"Enter model for annotation [default: {annotate_batch.DEFAULT_MODEL}]: "
        ).strip()
        if choice and choice in annotate_batch.BATCH_PRICING:
            args.model = choice
        elif choice and choice not in annotate_batch.BATCH_PRICING:
            print(f"Unknown model '{choice}', using default: {annotate_batch.DEFAULT_MODEL}")
            args.model = annotate_batch.DEFAULT_MODEL
        # else keep whatever was set via --model flag

    if step in ("annotate", "all"):
        run_annotate(args)


if __name__ == "__main__":
    main()
