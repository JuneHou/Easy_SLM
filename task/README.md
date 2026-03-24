# Reddit Search Pipeline — LLM Task Discovery (Two-Stream)

Reproducible pipeline that pulls Reddit posts and comments to study how people
use LLMs for daily tasks, split into two scientifically distinct streams:

| Stream | Search logic | Captures |
|--------|-------------|---------|
| **Stream 1** | `(A) AND (C)` | Small / local LLM use-practice posts |
| **Stream 2** | `(B) AND (C)` | Large / general LLM use-practice posts |

Queries are generated as the Cartesian product A×C (stream 1) and B×C (stream 2),
where each query phrase guarantees both an anchor signal (A or B) and a
use-practice signal (C) co-occur in every retrieved record.

## Keyword groups

| Group | Role | Terms |
|-------|------|-------|
| **A** | Small / local model terms | `local llm`, `self-hosted llm`, `slm`, `edge ai`, … (31 terms) |
| **B** | Large / general LLM terms | `llm`, `chatgpt`, `claude`, `foundation model`, … (20 terms) |
| **C** | Shared use-practice terms | `use case`, `workflow`, `how do you use`, `helps me`, … (22 terms) |

All three groups are defined in `config.py` as `GROUP_A`, `GROUP_B`, `GROUP_C`.

## Data sources

| Source | API base | Notes |
|--------|----------|-------|
| **PullPush** | `https://api.pullpush.io` | Free, no auth; supports full-text `q=` search |
| **Arctic Shift** | `https://arctic-shift.photon-reddit.com/api` | Free, no auth; `title=` / `body=` field search |

Both sources are queried by default; duplicates are merged by post/comment ID.

## Quick start

```bash
# 1. Install the single dependency
pip install -r requirements.txt

# 2. Run both streams (caution: generates many queries — see Query count below)
python reddit_pipeline.py

# 3. Run one stream at a time (recommended)
python reddit_pipeline.py --stream 1          # Stream 1: small/local (A×C)
python reddit_pipeline.py --stream 2          # Stream 2: large/general (B×C)

# 4. Use only one archive source
python reddit_pipeline.py --stream 1 --source pullpush
python reddit_pipeline.py --stream 2 --source arctic

# 5. Custom date window
python reddit_pipeline.py --stream 1 --start 2024-01-01 --end 2024-12-31

# 6. Specific subreddits
python reddit_pipeline.py --subreddits LocalLLaMA LocalLLM

# 7. Custom output directory
python reddit_pipeline.py --out /path/to/output

# 8. Enable Arctic Shift comment search (very slow — sequential scan)
python reddit_pipeline.py --stream 1 --arctic-comments
```

## Query count

| Stream | Formula | Queries |
|--------|---------|---------|
| Stream 1 | 31 (A) × 22 (C) | 682 |
| Stream 2 | 20 (B) × 22 (C) | 440 |
| **Total** | | **1 122** |

Many queries will return zero results (very specific phrase combinations).
All duplicate records are dropped by Reddit ID, so re-running is idempotent.
Run one stream at a time to stay within rate limits.

## Output files

| File | Description |
|------|-------------|
| `reddit_submissions.csv` | All unique posts (deduplicated by ID) |
| `reddit_comments.csv` | All unique comments (deduplicated by ID) |
| `reddit_combined.csv` | Posts + comments merged and sorted by date |
| `stats.json` | Counts by month, by stream, and by label |

### CSV columns

| Column | Description |
|--------|-------------|
| `source` | `pullpush` or `arctic_shift` |
| `kind` | `submission` or `comment` |
| `id` | Reddit post/comment ID |
| `subreddit` | e.g. `LocalLLaMA` |
| `date` | `YYYY-MM-DD` (UTC) |
| `title` | Post title (empty for comments) |
| `body` | Selftext / comment body (truncated at 2000 chars) |
| `url` | Full permalink |
| `score` | Reddit upvote score |
| `num_comments` | Number of comments (posts only) |
| `query` | The A×C or B×C query phrase that retrieved this record |
| `stream` | `small_local` or `large_general` |
| `task_labels` | Stream label (same as `stream`; extend in `config.py` for finer categories) |

## Customising keyword groups

Edit the three lists in `config.py`. `SEARCH_QUERIES` is rebuilt automatically
from the Cartesian products each time the module loads — no other file needs changing.

```python
# config.py
GROUP_A = [
    ...
    "my new local term",   # add to stream 1
]

GROUP_B = [
    ...
    "my new cloud term",   # add to stream 2
]

GROUP_C = [
    ...
    "my use signal",       # adds to BOTH streams
]
```

## Reproducibility notes

- All keyword groups, date windows, and subreddits are version-controlled in `config.py`.
- Both APIs are read-only; no authentication required.
- Results are deduplicated by Reddit ID, so re-running the same query is idempotent.
- The `stream` column records which experimental arm retrieved each record.
- `stats.json` captures per-stream counts for easy comparison and diffing.
