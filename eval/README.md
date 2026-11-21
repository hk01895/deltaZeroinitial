# DeltaZero eval: 30 cases from real GitHub projects

We test the verifier on **real** open-source work: merged pull requests that close an issue.
The issue is the requirement (what was asked for); the PR diff is what was delivered.

Each real issue + PR pair gives 3 cases with labels we can trust:

| Case | Requirement | Diff | Correct answer |
|---|---|---|---|
| `met` | the issue's requirement | the real merged PR | **met** |
| `swap` | a *different* issue's requirement | the same PR | **missing** (that PR never did it) |
| `strip` | the issue's requirement | the PR with all feature code removed (tests/docs only) | **missing** |

10 PRs × 3 = **30 cases**.

## Run it (on your laptop, ~5 min)

```bash
# 1. Build the cases from GitHub (uses only the Python standard library)
export GITHUB_TOKEN=$(gh auth token)      # or a personal access token; avoids rate limits
python3 eval/build_cases.py --n 10 --lang python
#   → eval/cases.jsonl  (30 cases)   eval/sources.json  (the 10 real PRs, with links)

# 2. Score the verifier through the backend (Shreya's API must be running)
python3 eval/run_eval.py --api http://localhost:8000/ui
#   → eval/results/eval.json   (exact shape the dashboard's Eval page reads via GET /eval)
#   → eval/results/details.csv (every case: actual vs predicted, for reviewing misses)

# Pipeline check without the backend (dumb keyword baseline):
python3 eval/run_eval.py --baseline
```

The backend needs one endpoint for this (Shreenidhi's verifier):
`POST /ui/verify` `{ "requirements": [{ "req_id": "REQ-1", "text": "..." }], "diff": "...", "sector": "general" }` → `RequirementVerdict[]`.

## Notes for the pitch
- "Met" labels assume a merged PR that closes an issue really did what the issue asked. Spot-check
  those 10 in `details.csv` (2 minutes) and fix any label that's wrong; say so in the pitch.
- Precision / recall treat a **gap** (partial or missing) as the positive class. "Check needed"
  answers count as "not flagged". That's honest: the AI didn't commit.
- Want other languages? `--lang typescript`, `--lang go`, etc. Mixing languages makes the result more convincing.
