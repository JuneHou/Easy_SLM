#!/usr/bin/env python3
"""
Batch Annotation Pipeline  (Step 2 of 2)
==========================================
Annotates reddit_combined.csv using the OpenAI Batch API (50 % cheaper than
synchronous calls).

This is Step 2.  Run Step 1 first (reddit_pipeline.py / run.py --step search)
so the exact record count is known before committing any API spend.

For each Reddit post / comment the model:
  1. Identifies concrete user tasks described in the text.
  2. Classifies each task into one of 4 themes and one of 10 sub-themes:

     Theme              Sub-theme    Description
     ─────────────────────────────────────────────────────────────────────
     Creation           Artifact     Generate a new artifact (code, text, image…)
                        Idea         Generate an idea to be used indirectly
     Information Search Search       Seek a specific fact or piece of information
                        Learn        Learn about a topic more broadly
                        Summarize    Condense content to its key elements
                        Analyze      Derive a new insight from information or data
     Advice             Improve      Produce a better version of an existing artifact
                        Guidance     Recommend a course of action or decision
                        Validation   Verify an artifact against rules / constraints
     Automation         Automation   Complete software tasks with less human effort

Model choice & cost  (Batch API, March 2026)
---------------------------------------------
Assumptions: ~1 400 input tokens/record (system prompt + post),
             ~200 expected output tokens/record (compact JSON annotation).
             max_tokens = 512 is the hard ceiling (safe for 5-task posts).

  Model          Batch $/1M in  Batch $/1M out  ~$/1K rec  ~$/10K rec
  ─────────────────────────────────────────────────────────────────────
  gpt-4.1           1.00           4.00            1.54       15.4
  gpt-5 / gpt-5.1   0.625          5.00            1.90       19.0   Tends to over-extract
  gpt-4o            1.25           5.00            1.97       19.7   ★ DEFAULT (conservative)
  gpt-4.1-mini      0.20           0.80            0.44        4.4   Cheap pilot
  gpt-4o-mini       0.075          0.30            0.17        1.7   Cheapest

  Use --model to override.  Run `python run.py --step estimate` to see the
  full table for your actual collected dataset before spending anything.

Workflow
--------
  Step 1  prepare   – read CSV, build batch JSONL, estimate cost, ask to confirm
  Step 2  upload    – upload JSONL to OpenAI Files API
  Step 3  submit    – create the batch job, save job state to batch_state.json
  Step 4  poll      – wait for completion (checks every 60 s)
  Step 5  download  – fetch output JSONL from OpenAI
  Step 6  merge     – parse annotations, write reddit_annotated.csv

Re-run safety
-------------
  - batch_state.json stores the file_id and batch_id so you can resume
    after a crash without re-uploading or re-submitting.
  - Records already present in reddit_annotated.csv are skipped in future runs.

Usage
-----
    export OPENAI_API_KEY=sk-...

    # Full pipeline with default model (gpt-4.1)
    python annotate_batch.py

    # Choose a different model
    python annotate_batch.py --model gpt-5
    python annotate_batch.py --model gpt-4.1-mini   # cheap pilot run

    # Show cost table only — no API calls
    python annotate_batch.py --cost-only

    # Skip already-annotated rows
    python annotate_batch.py --incremental

    # Resume a batch that is already submitted (skip upload/submit)
    python annotate_batch.py --resume

    # Dry run — build JSONL and show cost estimate, then exit
    python annotate_batch.py --dry-run

    # Custom paths
    python annotate_batch.py --input reddit_combined.csv --out reddit_annotated.csv
"""

import argparse
import csv
import json
import os
import sys
import time
import logging

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ── paths ─────────────────────────────────────────────────────────────────────
TASK_DIR     = os.path.dirname(os.path.abspath(__file__))
DEFAULT_IN   = os.path.join(TASK_DIR, "reddit_combined.csv")
DEFAULT_OUT  = os.path.join(TASK_DIR, "reddit_annotated.csv")
BATCH_JSONL  = os.path.join(TASK_DIR, "batch_input.jsonl")
RESULT_JSONL = os.path.join(TASK_DIR, "batch_output.jsonl")
STATE_FILE   = os.path.join(TASK_DIR, "batch_state.json")

# ── model registry  (Batch API $/1M tokens, March 2026) ──────────────────────
# (input_cost, output_cost)
BATCH_PRICING: dict[str, tuple[float, float]] = {
    "gpt-4.1":      (1.000, 4.00),
    "gpt-4o":       (1.250, 5.00),
    "gpt-5":        (0.625, 5.00),
    "gpt-5.1":      (0.625, 5.00),
    "gpt-5.2":      (0.875, 7.00),
    "gpt-5.4":      (1.250, 7.50),
    "gpt-4.1-mini": (0.200, 0.80),
    "gpt-4o-mini":  (0.075, 0.30),
    "gpt-4.1-nano": (0.050, 0.20),
}

DEFAULT_MODEL     = "gpt-4o"
# Typical output: ~30 tok/task × 2 tasks + ~60 tok fixed overhead ≈ 120-200 tok.
# 512 is a safe ceiling for even 5-task posts and prevents runaway responses.
MAX_OUTPUT_TOKENS = 512

# ── taxonomy ──────────────────────────────────────────────────────────────────
THEMES: list[str] = ["Creation", "Information Search", "Advice", "Automation"]

SUBTHEMES: dict[str, list[str]] = {
    "Creation":           ["Artifact", "Idea"],
    "Information Search": ["Search", "Learn", "Summarize", "Analyze"],
    "Advice":             ["Improve", "Guidance", "Validation"],
    "Automation":         ["Automation"],
}

# ── prompt ────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are annotating Reddit posts/comments for research on how people use language models (local or cloud-based) in everyday life.

Your job:
  1. Identify every concrete user task described in the text.
  2. Classify each task into exactly one theme and one sub-theme from the taxonomy below.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TAXONOMY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Theme: Creation
  • Artifact  – Generate a new artifact to be used directly or with some modification.
                Example: "write a Python code snippet for me"
  • Idea      – Generate an idea to be used indirectly (not a finished artifact).
                Example: "suggest persona ideas for my game"

Theme: Information Search
  • Search    – Seek a specific fact or piece of information.
                Example: "find the best description of this open-source library"
  • Learn     – Learn about a topic more broadly.
                Example: "explain how transformer architectures work"
  • Summarize – Condense a piece of content to its essential elements.
                Example: "summarize text from external websites"
  • Analyze   – Derive a new insight from existing information or data.
                Example: "analyze server logs to find error patterns"

Theme: Advice
  • Improve   – Produce a better version of an existing artifact.
                Example: "rewrite this paragraph so it is clearer"
  • Guidance  – Recommend a course of action or help make a decision.
                Example: "estimate how long this project should take"
  • Validation – Check whether an artifact satisfies rules or constraints.
                Example: "verify this document includes all required sections"

Theme: Automation
  • Automation – Complete a task in software with reduced or no human effort.
                Example: "schedule meetings and resolve calendar conflicts"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Rules:
1. task   – 2 to 5 words, verb-noun form ("summarize meeting notes", not "I use it to summarize my meeting notes").
2. evidence – copy the shortest verbatim span that supports the task (≤10 words).
3. notes  – one sentence, ≤15 words, or empty string "" if self-evident.
4. Be conservative: only extract tasks clearly supported by the text.
5. If a post is mainly a release announcement or feature description, only extract tasks if an end-user activity is clearly implied.
6. If no clear task is present, set no_task_found=true and return an empty tasks array.
7. Use ONLY the theme/sub-theme names listed above — do not invent new categories.

Do NOT extract:
- Tool names, model names, APIs, or setup details
- General discussion of LLMs without a concrete activity
- Installation, quantization, hosting, or benchmarking steps
- Vague benefits like "it's faster" or "it respects my privacy"

Return ONLY compact valid JSON — no extra whitespace or explanation outside the JSON:

{"no_task_found":true|false,"tasks":[{"task":"<2-5 word verb-noun phrase>","theme":"<theme>","subtheme":"<subtheme>","evidence":"<≤10 words verbatim>"}],"notes":"<≤15 words or empty>"}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EXAMPLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Input:
"I use my local model to summarize RSS feeds and turn them into a podcast script for my commute."
Output:
{"no_task_found":false,"tasks":[{"task":"summarize RSS feeds","theme":"Information Search","subtheme":"Summarize","evidence":"summarize RSS feeds"},{"task":"generate podcast script","theme":"Creation","subtheme":"Artifact","evidence":"turn them into a podcast script"}],"notes":"Summarize then create artifact."}

Input:
"I ask ChatGPT to review my cover letter and flag anything that sounds unprofessional."
Output:
{"no_task_found":false,"tasks":[{"task":"validate cover letter tone","theme":"Advice","subtheme":"Validation","evidence":"flag anything that sounds unprofessional"}],"notes":""}

Input:
"KoboldCpp has a writing UI, persistent stories, editing tools, characters, and scenarios."
Output:
{"no_task_found":false,"tasks":[{"task":"write stories","theme":"Creation","subtheme":"Artifact","evidence":"writing UI, persistent stories"},{"task":"edit stories","theme":"Advice","subtheme":"Improve","evidence":"editing tools"}],"notes":"Feature list implies two user activities."}

Input:
"Here is my explanation of how LLMs work and why quantization matters."
Output:
{"no_task_found":true,"tasks":[],"notes":""}"""


def _user_message(title: str, body: str, subreddit: str) -> str:
    if title:
        kind_block = f"Title: {title}\nBody: {body[:1000]}"
    else:
        kind_block = f"Comment: {body[:1000]}"
    return f"{kind_block}\nSubreddit: {subreddit}"


def _estimate_tokens(text: str) -> int:
    """Rough estimate: 1 token ≈ 4 characters."""
    return len(text) // 4


# ── Cost table  (callable from run.py without building full JSONL) ─────────────

def cost_table(input_csv: str, annotated_csv: str = DEFAULT_OUT) -> None:
    """
    Print a model-comparison cost table based on the actual record count in
    input_csv.  Does NOT call any API.  Called by run.py between steps 1 and 2.
    """
    if not os.path.exists(input_csv):
        print(f"[estimate] Input CSV not found: {input_csv}")
        return

    # Count unannotated records
    annotated_ids: set[str] = set()
    if os.path.exists(annotated_csv):
        with open(annotated_csv, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                annotated_ids.add(row["id"])

    n_total = 0
    n_to_annotate = 0
    sys_tok = _estimate_tokens(SYSTEM_PROMPT)
    total_input_tok = 0

    with open(input_csv, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            n_total += 1
            rid   = row.get("id", "")
            title = (row.get("title") or "").strip()
            body  = (row.get("body")  or "").strip()
            if not title and not body:
                continue
            if rid in annotated_ids:
                continue
            n_to_annotate += 1
            user_tok = _estimate_tokens(_user_message(title, body, row.get("subreddit", "")))
            total_input_tok += sys_tok + user_tok

    if n_to_annotate == 0:
        print("[estimate] No unannotated records found — nothing to annotate.")
        return

    avg_in  = total_input_tok / n_to_annotate
    exp_out = 200   # realistic: ~30 tok/task × 2 tasks + ~60 tok fixed overhead
    wc_out  = MAX_OUTPUT_TOKENS

    print()
    print("╔══════════════════════════════════════════════════════════════════════════╗")
    print("║                    ANNOTATION COST ESTIMATE                             ║")
    print("╠══════════════════════════════════════════════════════════════════════════╣")
    print(f"║  Records in CSV          : {n_total:>8,}                                    ║")
    print(f"║  Already annotated       : {len(annotated_ids):>8,}                                    ║")
    print(f"║  To annotate this run    : {n_to_annotate:>8,}                                    ║")
    print(f"║  Avg input tokens/record : {avg_in:>8,.0f}  (system prompt + post)          ║")
    print(f"║  Expected output/record  : {exp_out:>8,}  tokens  (typical JSON)            ║")
    print(f"║  Max output ceiling      : {wc_out:>8,}  tokens  (hard limit)               ║")
    print("╠═════════════════╦══════════════╦═══════════════╦════════════╦════════════╣")
    print("║ Model           ║ $/1M in(bat) ║ $/1M out(bat) ║ Exp. cost  ║ Worst case ║")
    print("╠═════════════════╬══════════════╬═══════════════╬════════════╬════════════╣")

    ordered = sorted(BATCH_PRICING.items(), key=lambda x: (
        x[1][0] * avg_in / 1e6 + x[1][1] * exp_out / 1e6
    ) * n_to_annotate)

    for model, (ci, co) in ordered:
        exp_cost = n_to_annotate * (ci * avg_in / 1e6 + co * exp_out / 1e6)
        wc_cost  = n_to_annotate * (ci * avg_in / 1e6 + co * wc_out  / 1e6)
        star = " ★" if model == DEFAULT_MODEL else "  "
        print(f"║ {model+star:<15} ║   ${ci:>8.4f}   ║    ${co:>8.4f}  ║  ${exp_cost:>7.2f}  ║  ${wc_cost:>7.2f}  ║")

    print("╚═════════════════╩══════════════╩═══════════════╩════════════╩════════════╝")
    print(f"  Exp. cost = expected ~{exp_out} output tok/rec (compact JSON)  |  Worst case = {wc_out} tok/rec ceiling")
    print(f"  ★ = default model ({DEFAULT_MODEL})")
    print()


# ── Step 1: prepare ───────────────────────────────────────────────────────────

def prepare(input_csv: str, incremental: bool, model: str = DEFAULT_MODEL) -> list[dict]:
    """
    Read input CSV, optionally skip already-annotated rows, build batch requests.
    Returns list of request dicts ready to write as JSONL.
    """
    annotated_ids: set[str] = set()
    if incremental and os.path.exists(DEFAULT_OUT):
        with open(DEFAULT_OUT, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                annotated_ids.add(row["id"])
        log.info("Incremental mode: %d already-annotated IDs loaded", len(annotated_ids))

    requests_out = []
    skipped = 0

    with open(input_csv, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rid = row["id"]

            if rid in annotated_ids:
                skipped += 1
                continue

            title     = (row.get("title") or "").strip()
            body      = (row.get("body")  or "").strip()
            subreddit = row.get("subreddit", "")

            if not title and not body:
                skipped += 1
                continue

            user_msg = _user_message(title, body, subreddit)

            requests_out.append({
                "custom_id": rid,
                "method":    "POST",
                "url":       "/v1/chat/completions",
                "body": {
                    "model": model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user",   "content": user_msg},
                    ],
                    "max_completion_tokens": MAX_OUTPUT_TOKENS,
                    "temperature":     0,
                    "response_format": {"type": "json_object"},
                },
            })

    log.info("Records to annotate : %d", len(requests_out))
    log.info("Records skipped     : %d", skipped)
    return requests_out


def cost_estimate(requests: list[dict], model: str = DEFAULT_MODEL) -> tuple[int, int, float]:
    """
    Returns (input_tokens, expected_output_tokens, estimated_cost_usd).
    Expected output uses 200 tokens/record (realistic compact JSON) — the actual
    compact JSON output is typically 100-250 tokens; MAX_OUTPUT_TOKENS (512) is the hard ceiling.
    """
    ci, co = BATCH_PRICING.get(model, BATCH_PRICING[DEFAULT_MODEL])
    sys_tok   = _estimate_tokens(SYSTEM_PROMPT)
    input_tok = sum(
        sys_tok + _estimate_tokens(r["body"]["messages"][1]["content"])
        for r in requests
    )
    exp_out_per_rec = 200   # realistic compact JSON output per record
    output_tok = exp_out_per_rec * len(requests)
    cost       = input_tok / 1_000_000 * ci + output_tok / 1_000_000 * co
    return input_tok, output_tok, cost


def write_batch_jsonl(requests: list[dict], path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        for req in requests:
            f.write(json.dumps(req) + "\n")
    log.info("Batch JSONL written: %s  (%d requests)", path, len(requests))


# ── Step 1b: sample test ──────────────────────────────────────────────────────

def run_sample_test(client, requests: list[dict], model: str) -> bool:
    """
    Make one synchronous call with the first request to verify that the model,
    parameters, and prompt all work before submitting the full batch.
    Returns True if the test passes, False if it fails.
    """
    if not requests:
        return True

    sample = requests[0]
    rid    = sample["custom_id"]
    msgs   = sample["body"]["messages"]

    print()
    print("─" * 60)
    print("  SAMPLE TEST  (1 synchronous call before full batch)")
    print("─" * 60)
    print(f"  Record ID : {rid}")
    user_text = msgs[1]["content"]
    preview   = user_text[:120].replace("\n", " ")
    print(f"  Input     : {preview}…")
    print()

    try:
        resp = client.chat.completions.create(
            model    = model,
            messages = msgs,
            max_completion_tokens = MAX_OUTPUT_TOKENS,
            temperature           = 0,
            response_format       = {"type": "json_object"},
        )
    except Exception as exc:
        print(f"  [FAIL] API error: {exc}")
        print("─" * 60)
        return False

    raw  = resp.choices[0].message.content or ""
    tok  = resp.usage
    ann  = _parse_annotation(raw)

    print(f"  Tokens used   : {tok.prompt_tokens} in / {tok.completion_tokens} out")
    print(f"  Raw response  :")
    # Pretty-print the JSON, indented
    try:
        pretty = json.dumps(json.loads(raw), indent=4)
        for line in pretty.splitlines():
            print(f"    {line}")
    except Exception:
        print(f"    {raw[:500]}")
    print()

    if ann["annotation_error"]:
        print(f"  [FAIL] Parse error: {ann['annotation_error']}")
        print("─" * 60)
        return False

    if ann["no_task_found"]:
        print("  Result  : no_task_found=true  (valid — this record has no clear task)")
    else:
        tasks = ann["tasks"].split("|")
        themes = ann["task_themes"].split("|")
        subs   = ann["task_subthemes"].split("|")
        print(f"  Result  : {len(tasks)} task(s) extracted")
        for t, th, st in zip(tasks, themes, subs):
            print(f"    • [{th} / {st}]  {t}")

    print("─" * 60)
    return True


# ── Step 2: upload ────────────────────────────────────────────────────────────

def upload_file(client, jsonl_path: str) -> str:
    log.info("Uploading %s to OpenAI Files API…", jsonl_path)
    with open(jsonl_path, "rb") as f:
        response = client.files.create(file=f, purpose="batch")
    file_id = response.id
    log.info("Uploaded — file_id: %s", file_id)
    return file_id


# ── Step 3: submit ────────────────────────────────────────────────────────────

def submit_batch(client, file_id: str) -> str:
    log.info("Creating batch job…")
    batch = client.batches.create(
        input_file_id     = file_id,
        endpoint          = "/v1/chat/completions",
        completion_window = "24h",
    )
    batch_id = batch.id
    log.info("Batch submitted — batch_id: %s", batch_id)
    return batch_id


def save_state(file_id: str, batch_id: str) -> None:
    with open(STATE_FILE, "w") as f:
        json.dump({"file_id": file_id, "batch_id": batch_id}, f, indent=2)
    log.info("State saved → %s", STATE_FILE)


def load_state() -> dict:
    with open(STATE_FILE) as f:
        return json.load(f)


# ── Step 4: poll ──────────────────────────────────────────────────────────────

def poll_batch(client, batch_id: str, poll_interval: int = 60) -> str:
    """
    Poll until the batch reaches a terminal state.
    Returns output_file_id on full or partial success.
    Downloads and prints the error file if all requests failed, then exits.
    """
    log.info("Polling batch %s (every %ds)…", batch_id, poll_interval)
    while True:
        batch  = client.batches.retrieve(batch_id)
        status = batch.status
        counts = batch.request_counts
        n_completed = getattr(counts, "completed", 0) or 0
        n_failed    = getattr(counts, "failed",    0) or 0
        n_total     = getattr(counts, "total",     0) or 0
        log.info("  status=%-12s  completed=%s  failed=%s  total=%s",
                 status, n_completed, n_failed, n_total)

        if status == "completed":
            log.info("Batch completed.")

            if not batch.output_file_id:
                # All requests failed individually — show the error file
                log.error("output_file_id is None: all %d requests failed.", n_failed)
                error_file_id = getattr(batch, "error_file_id", None)
                if error_file_id:
                    log.error("Downloading error file (file_id=%s) for details…", error_file_id)
                    try:
                        err_path = os.path.join(os.path.dirname(RESULT_JSONL), "batch_errors.jsonl")
                        content  = client.files.content(error_file_id)
                        with open(err_path, "wb") as fh:
                            fh.write(content.read())
                        log.error("Error details saved → %s", err_path)
                        # Print the first few error lines so the cause is visible immediately
                        with open(err_path, encoding="utf-8") as fh:
                            for i, line in enumerate(fh):
                                if i >= 3:
                                    log.error("  … (see %s for all errors)", err_path)
                                    break
                                try:
                                    obj  = json.loads(line)
                                    body = obj.get("response", {}).get("body", {})
                                    code = body.get("error", {}).get("code", "?")
                                    msg  = body.get("error", {}).get("message", line[:200])
                                    log.error("  [%s] %s", code, msg[:200])
                                except Exception:
                                    log.error("  %s", line[:200])
                    except Exception as exc:
                        log.error("Could not download error file: %s", exc)
                else:
                    log.error("No error_file_id available. Check the batch in the OpenAI dashboard.")
                sys.exit(1)

            if n_failed > 0:
                log.warning("%d / %d requests failed — partial results in output file.",
                            n_failed, n_total)

            return batch.output_file_id

        if status in ("failed", "expired", "cancelled"):
            log.error("Batch ended with status: %s", status)
            if batch.errors:
                for err in batch.errors.data:
                    log.error("  error: %s", err)
            sys.exit(1)

        time.sleep(poll_interval)


# ── Step 5: download ──────────────────────────────────────────────────────────

def download_results(client, output_file_id: str, path: str) -> None:
    log.info("Downloading results (file_id=%s)…", output_file_id)
    content = client.files.content(output_file_id)
    with open(path, "wb") as f:
        f.write(content.read())
    log.info("Results saved → %s", path)


# ── Step 6: merge ─────────────────────────────────────────────────────────────

_VALID_THEMES    = set(THEMES)
_VALID_SUBTHEMES = {st for sts in SUBTHEMES.values() for st in sts}


def _parse_annotation(raw_json: str) -> dict:
    """
    Parse the model's JSON output.
    Returns flat columns suitable for a CSV row:
      no_task_found    – bool
      tasks            – pipe-separated task phrases
      task_themes      – pipe-separated theme per task  (aligned with tasks)
      task_subthemes   – pipe-separated subtheme per task
      evidence         – pipe-separated evidence spans per task
      annotation_notes – brief explanation from the model
      annotation_error – non-empty if parsing failed
    """
    try:
        obj = json.loads(raw_json)

        no_task    = bool(obj.get("no_task_found", True))
        raw_tasks  = obj.get("tasks") or []

        task_phrases   = []
        task_themes    = []
        task_subthemes = []
        evidence_spans = []

        for t in raw_tasks:
            if not isinstance(t, dict):
                continue
            phrase   = str(t.get("task",     "") or "").strip()
            theme    = str(t.get("theme",    "") or "").strip()
            subtheme = str(t.get("subtheme", "") or "").strip()
            evid     = str(t.get("evidence", "") or "").strip()

            if not phrase:
                continue

            if theme not in _VALID_THEMES:
                theme = f"unknown:{theme}"
            if subtheme not in _VALID_SUBTHEMES:
                subtheme = f"unknown:{subtheme}"

            task_phrases.append(phrase)
            task_themes.append(theme)
            task_subthemes.append(subtheme)
            evidence_spans.append(evid)

        return {
            "no_task_found":    no_task or not task_phrases,
            "tasks":            "|".join(task_phrases),
            "task_themes":      "|".join(task_themes),
            "task_subthemes":   "|".join(task_subthemes),
            "evidence":         "|".join(evidence_spans),
            "annotation_notes": str(obj.get("notes") or "")[:300],
            "annotation_error": "",
        }
    except Exception as exc:
        return {
            "no_task_found":    True,
            "tasks":            "",
            "task_themes":      "",
            "task_subthemes":   "",
            "evidence":         "",
            "annotation_notes": "",
            "annotation_error": f"parse_error: {exc} | raw: {raw_json[:200]}",
        }


ANNOTATION_FIELDS = [
    "no_task_found",
    "tasks",
    "task_themes",
    "task_subthemes",
    "evidence",
    "annotation_notes",
    "annotation_error",
]


def merge_annotations(input_csv: str, result_jsonl: str, out_csv: str) -> None:
    original: dict[str, dict] = {}
    with open(input_csv, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            original[row["id"]] = row

    annotated: dict[str, dict] = {}
    if os.path.exists(out_csv):
        with open(out_csv, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                annotated[row["id"]] = row

    parsed_count = 0
    error_count  = 0
    with open(result_jsonl, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            result = json.loads(line)
            rid    = result.get("custom_id", "")

            try:
                content = (result["response"]["body"]
                           ["choices"][0]["message"]["content"])
                ann = _parse_annotation(content)
            except Exception as exc:
                ann = {
                    "no_task_found":    True,
                    "tasks":            "",
                    "task_themes":      "",
                    "task_subthemes":   "",
                    "evidence":         "",
                    "annotation_notes": "",
                    "annotation_error": f"response_error: {exc}",
                }

            if ann["annotation_error"]:
                error_count += 1

            if rid in original:
                row = dict(original[rid])
                row.update(ann)
                annotated[rid] = row
                parsed_count += 1

    log.info("Annotations parsed : %d  (errors: %d)", parsed_count, error_count)

    base_fields = list(
        csv.DictReader(open(input_csv, newline="", encoding="utf-8")).fieldnames or []
    )
    seen: set[str] = set(base_fields)
    fieldnames = base_fields + [f for f in ANNOTATION_FIELDS if f not in seen]

    rows = sorted(annotated.values(), key=lambda r: r.get("date", ""))
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)

    task_count = sum(1 for r in rows if r.get("tasks"))
    log.info("Saved %d annotated rows → %s", len(rows), out_csv)
    log.info("Records with ≥1 task : %d / %d", task_count, len(rows))

    theme_counts:    dict[str, int] = {}
    subtheme_counts: dict[str, int] = {}
    for r in rows:
        for th in (r.get("task_themes") or "").split("|"):
            if th and not th.startswith("unknown:"):
                theme_counts[th] = theme_counts.get(th, 0) + 1
        for st in (r.get("task_subthemes") or "").split("|"):
            if st and not st.startswith("unknown:"):
                subtheme_counts[st] = subtheme_counts.get(st, 0) + 1

    if theme_counts:
        log.info("Theme distribution:")
        for th, cnt in sorted(theme_counts.items(), key=lambda x: -x[1]):
            log.info("  %-22s %d", th, cnt)
    if subtheme_counts:
        log.info("Sub-theme distribution:")
        for st, cnt in sorted(subtheme_counts.items(), key=lambda x: -x[1]):
            log.info("  %-22s %d", st, cnt)


# ── CLI ───────────────────────────────────────────────────────────────────────

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        description="Batch annotation pipeline (Step 2) — annotates reddit_combined.csv"
    )
    p.add_argument("--model",       default=DEFAULT_MODEL,
                   choices=list(BATCH_PRICING),
                   help=f"OpenAI model to use (default: {DEFAULT_MODEL})")
    p.add_argument("--input",       default=DEFAULT_IN,
                   help=f"Input CSV (default: {DEFAULT_IN})")
    p.add_argument("--out",         default=DEFAULT_OUT,
                   help=f"Output annotated CSV (default: {DEFAULT_OUT})")
    p.add_argument("--cost-only",   action="store_true",
                   help="Print cost table for all models then exit — no API calls")
    p.add_argument("--dry-run",     action="store_true",
                   help="Build JSONL and show single-model estimate, then exit")
    p.add_argument("--incremental", action="store_true",
                   help="Skip rows already present in the output CSV")
    p.add_argument("--resume",      action="store_true",
                   help=f"Resume using IDs saved in {STATE_FILE} (skip upload+submit)")
    p.add_argument("--poll-only",   action="store_true",
                   help="Poll an in-progress batch then download+merge")
    p.add_argument("--merge-only",  action="store_true",
                   help=f"Skip API calls — just merge {RESULT_JSONL} into output CSV")
    p.add_argument("--poll-interval", type=int, default=60,
                   help="Seconds between status checks (default: 60)")
    return p


def main() -> None:
    args = build_parser().parse_args()

    # ── cost-only shortcut ────────────────────────────────────────────────────
    if args.cost_only:
        cost_table(args.input, args.out)
        return

    # ── merge-only shortcut ───────────────────────────────────────────────────
    if args.merge_only:
        if not os.path.exists(RESULT_JSONL):
            log.error("No result file found: %s", RESULT_JSONL)
            sys.exit(1)
        merge_annotations(args.input, RESULT_JSONL, args.out)
        return

    # ── prepare ───────────────────────────────────────────────────────────────
    if not (args.resume or args.poll_only):
        requests = prepare(args.input, args.incremental, args.model)
        if not requests:
            log.info("Nothing to annotate — all records already done.")
            return

        ci, co = BATCH_PRICING[args.model]
        input_tok, output_tok, cost = cost_estimate(requests, args.model)
        log.info("── Cost estimate ──────────────────────────────")
        log.info("  Model          : %s  ($%.4f/1M in, $%.4f/1M out)", args.model, ci, co)
        log.info("  Requests       : %d", len(requests))
        log.info("  Input tokens   : ~%s", f"{input_tok:,}")
        log.info("  Output tokens  : ~%s  (est. 200/rec; ceiling %d)", f"{output_tok:,}", MAX_OUTPUT_TOKENS)
        log.info("  Estimated cost : ~$%.3f", cost)
        log.info("───────────────────────────────────────────────")

        if args.dry_run:
            log.info("Dry run — exiting before API calls.")
            write_batch_jsonl(requests, BATCH_JSONL)
            return

    # ── OpenAI client (needed for sample test + batch) ────────────────────────
    try:
        from openai import OpenAI
    except ImportError:
        log.error("openai package not installed. Run: pip install openai")
        sys.exit(1)

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        log.error("OPENAI_API_KEY environment variable not set.")
        sys.exit(1)
    client = OpenAI(api_key=api_key)

    # ── sample test + full-batch confirmation ─────────────────────────────────
    if not (args.resume or args.poll_only):
        if not run_sample_test(client, requests, args.model):
            log.error("Sample test failed — fix the issue before submitting the full batch.")
            sys.exit(1)

        answer = input(
            f"\nSample OK. Proceed with full batch: {len(requests)} requests"
            f" on {args.model} (~${cost:.2f})? [y/N] "
        ).strip().lower()
        if answer != "y":
            log.info("Aborted.")
            return

        write_batch_jsonl(requests, BATCH_JSONL)

    # ── upload + submit ───────────────────────────────────────────────────────
    if args.resume or args.poll_only:
        if not os.path.exists(STATE_FILE):
            log.error("No state file found: %s  — cannot resume.", STATE_FILE)
            sys.exit(1)
        state    = load_state()
        batch_id = state["batch_id"]
        log.info("Resuming batch_id=%s", batch_id)
    else:
        file_id  = upload_file(client, BATCH_JSONL)
        batch_id = submit_batch(client, file_id)
        save_state(file_id, batch_id)

    # ── poll ──────────────────────────────────────────────────────────────────
    output_file_id = poll_batch(client, batch_id, args.poll_interval)

    # ── download ──────────────────────────────────────────────────────────────
    download_results(client, output_file_id, RESULT_JSONL)

    # ── merge ─────────────────────────────────────────────────────────────────
    merge_annotations(args.input, RESULT_JSONL, args.out)

    log.info("=== Annotation complete ===")
    log.info("Output: %s", args.out)


if __name__ == "__main__":
    main()
