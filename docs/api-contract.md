# DeltaZero API contract

Agree on this at the 11:45 sync. The frontend (`web/lib/types.ts`) uses these exact field names.
Backend: FastAPI on `http://localhost:8000`. Enable CORS for `http://localhost:3000`.

| Method | Path | Returns | Owner |
|---|---|---|---|
| GET | `/coverage?sector=general\|medical\|finance` | `Coverage` | Shreya |
| GET | `/prs` | `PRSummary[]` | Shreya |
| GET | `/prs/{pr_id}/review?sector=` | `PRReview` | Shreya (calls Shreenidhi's verifier) |
| POST | `/prs/{pr_id}/rerun?sector=` | `PRReview` (fresh run on latest commit) | Shreya |
| POST | `/overrides` | `Override` | Shreya |
| GET | `/overrides` | `Override[]` | Shreya |
| GET | `/eval` | `EvalResult` | Shreenidhi |
| GET | `/rulepacks/{sector}` | `RulePack` | Nimalan |
| POST | `/sharpen` | Ticket Sharpener result (Nimalan defines) | Nimalan |

## Verdict values
`"met" | "partial" | "missing" | "needs_human"`

## RequirementVerdict (one per requirement, from the verifier)
```json
{
  "req_id": "REQ-003",
  "requirement": "Patients receive a confirmation email within 60 seconds of booking.",
  "verdict": "partial",
  "confidence": 0.71,
  "model": "super",
  "thinking": true,
  "latency_ms": 4300,
  "reasoning": "Email is queued to a 5-minute batch job, so 60s is not met.",
  "evidence": [
    { "file": "api/services/notify.py", "start_line": 10, "end_line": 12, "code": "def queue_confirmation(appt): ..." }
  ],
  "evidence_verified": true,
  "downgraded_from": null,
  "suggested_diff": "--- a/...\n+++ b/...\n@@ ...",
  "suggested_test": "def test_...: ...",
  "override": null
}
```
- `evidence_verified`: Evidence Guard result (quoted code found in the diff).
- `downgraded_from`: set when Evidence Guard turned a verdict into `needs_human`.
- `override`: latest human override for this requirement on this PR, or `null`.

## PRReview
```json
{
  "pr_id": 12, "title": "Add appointment booking endpoint",
  "url": "https://github.com/.../pull/12",
  "ticket_key": "CARE-12", "ticket_url": "https://.../CARE-12",
  "branch": "CARE-12-booking", "head_sha": "a71d4e2",
  "reviewed_at": "2026-11-21T15:02:00Z", "sector": "medical",
  "verdicts": [ /* RequirementVerdict[] */ ]
}
```

## POST /overrides body
```json
{ "pr_id": 12, "req_id": "REQ-005", "new_verdict": "met", "reason": "Audit logging is done by the API gateway", "author": "reviewer" }
```
Returns the stored `Override` (adds `id`, `original_verdict`, `created_at`).
Past overrides are fed into the verifier prompt as examples on the next run.

## Coverage
```json
{
  "project": "CareSlot – Patient Appointment API",
  "spec_name": "careslot-prd-v1.md",
  "updated_at": "...",
  "requirements": [
    { "req_id": "REQ-009", "text": "...", "status": "never_ticketed", "priority": "medium",
      "ticket_key": null, "ticket_url": null, "pr_id": null, "pr_url": null, "drift": null }
  ]
}
```
`status`: `"met" | "partial" | "missing" | "never_ticketed" | "not_started"`
`drift`: text when spec and ticket disagree, e.g. `"Spec says 24 hours, ticket says 12 hours"`.
`reason`: one short plain-language line on why a requirement is not met (e.g. `"No cancel endpoint in PR #12"`), `null` when met.

## EvalResult
```json
{
  "run_at": "...", "n_cases": 30,
  "precision": 0.889, "recall": 0.941, "false_positive_rate": 0.154,
  "labels": ["met", "partial", "missing", "needs_human"],
  "confusion": [[9,1,0,0],[1,6,1,0],[0,1,8,0],[0,0,1,2]],
  "latency": { "fast_avg_ms": 850, "deep_avg_ms": 4700, "fast_share": 0.7, "routed_avg_ms": 2005, "all_deep_avg_ms": 4700 }
}
```
Positive class for precision/recall = a **gap** (actual `partial` or `missing`). `confusion` rows = actual, cols = predicted.

## RulePack
```json
{ "sector": "medical", "name": "Medical / health data", "rules": [ { "id": "MED-1", "text": "..." } ] }
```

## Ask Δ assistant (optional; UI falls back to a built-in mock brain)
`POST /assistant` body `{ "message": "Change cancellations to 12 hours", "sector": "medical" }` returns:
```json
{
  "reply": "Heads up, that conflicts with the spec.",
  "pushback": {
    "change": "Change cancellations to 12 hours",
    "req_id": "REQ-004",
    "rule": "The spec for REQ-004 says 24 hours...",
    "suggestion": "Update the spec first, or keep the spec value."
  },
  "links": [ { "label": "Open PR #12", "href": "/pr/12" } ]
}
```
`pushback` is `null` when the change is fine. `reply` supports `**bold**` and line breaks.
`POST /assistant/changes` receives `{ change, req_id, decision: "applied" | "kept_spec" | "overridden", reason?, at }` so overrides can be fed back into prompts.
