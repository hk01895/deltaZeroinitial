#!/usr/bin/env python3
"""
Score DeltaZero's verifier on eval/cases.jsonl and write eval/results/eval.json
in the exact EvalResult shape the dashboard's Eval page reads (GET /eval).

The verifier is called through the backend:
  POST {API}/verify  body: {"requirements": [{"req_id": "REQ-1", "text": "..."}], "diff": "...", "sector": "general"}
  returns: a list of RequirementVerdict (see docs/api-contract.md), or {"verdicts": [...]}

Usage:
  python3 eval/run_eval.py --api http://localhost:8000
  python3 eval/run_eval.py --baseline        # no backend: keyword-overlap baseline, to test the pipeline
"""
import argparse
import csv
import json
import os
import re
import time
import urllib.request
from datetime import datetime, timezone

LABELS = ["met", "partial", "missing", "needs_human"]
GAP = {"partial", "missing"}


def call_verifier(api, requirement, diff):
    body = json.dumps({"requirements": [{"req_id": "REQ-1", "text": requirement}], "diff": diff, "sector": "general"}).encode()
    req = urllib.request.Request(api.rstrip("/") + "/verify", data=body, headers={"Content-Type": "application/json"})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=180) as r:
        data = json.loads(r.read())
    ms = int((time.time() - t0) * 1000)
    verdicts = data.get("verdicts", data) if isinstance(data, dict) else data
    v = verdicts[0]
    v.setdefault("latency_ms", ms)
    return v


def baseline(requirement, diff):
    """Dumb keyword-overlap 'verifier' so the pipeline can be tested without the backend."""
    words = {w for w in re.findall(r"[a-z]{4,}", requirement.lower())}
    added = " ".join(l for l in diff.splitlines() if l.startswith("+")).lower()
    hits = sum(1 for w in words if w in added)
    ratio = hits / max(1, len(words))
    verdict = "met" if ratio > 0.35 else "partial" if ratio > 0.2 else "missing"
    return {"verdict": verdict, "confidence": round(0.5 + ratio / 2, 2), "model": "lightning", "thinking": False, "latency_ms": 1}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cases", default="eval/cases.jsonl")
    ap.add_argument("--api", default=os.environ.get("DELTAZERO_API", "http://localhost:8000/ui"))
    ap.add_argument("--baseline", action="store_true")
    ap.add_argument("--out", default="eval/results")
    a = ap.parse_args()

    cases = [json.loads(l) for l in open(a.cases) if l.strip()]
    rows, conf = [], [[0] * 4 for _ in LABELS]
    lat = {"lightning": [], "super": []}

    for c in cases:
        try:
            v = baseline(c["requirement"], c["diff"]) if a.baseline else call_verifier(a.api, c["requirement"], c["diff"])
            pred = v.get("verdict", "needs_human")
        except Exception as e:  # noqa: BLE001
            v, pred = {"error": str(e)}, "needs_human"
        if pred not in LABELS:
            pred = "needs_human"
        conf[LABELS.index(c["label"])][LABELS.index(pred)] += 1
        if v.get("model") in lat and v.get("latency_ms") is not None:
            lat[v["model"]].append(v["latency_ms"])
        rows.append({"id": c["id"], "repo": c["repo"], "kind": c["kind"], "label": c["label"], "predicted": pred,
                     "correct": (pred in GAP) == (c["label"] in GAP) and pred != "needs_human",
                     "confidence": v.get("confidence"), "model": v.get("model"), "latency_ms": v.get("latency_ms"),
                     "pr_url": c["pr_url"], "requirement": c["requirement"][:160], "error": v.get("error", "")})
        print(f"{c['id']:>10}  actual={c['label']:<8} predicted={pred:<11} {'✓' if rows[-1]['correct'] else '✕'}")

    # Positive class = a real gap (partial/missing). needs_human counts as "not flagged as a gap".
    tp = sum(1 for r in rows if r["label"] in GAP and r["predicted"] in GAP)
    fp = sum(1 for r in rows if r["label"] not in GAP and r["predicted"] in GAP)
    fn = sum(1 for r in rows if r["label"] in GAP and r["predicted"] not in GAP)
    tn = sum(1 for r in rows if r["label"] not in GAP and r["predicted"] not in GAP)
    avg = lambda xs: int(sum(xs) / len(xs)) if xs else 0  # noqa: E731
    n_fast, n_deep = len(lat["lightning"]), len(lat["super"])
    fast_ms, deep_ms = avg(lat["lightning"]), avg(lat["super"])
    share = n_fast / max(1, n_fast + n_deep)
    result = {
        "run_at": datetime.now(timezone.utc).isoformat(),
        "n_cases": len(rows),
        "precision": round(tp / max(1, tp + fp), 3),
        "recall": round(tp / max(1, tp + fn), 3),
        "false_positive_rate": round(fp / max(1, fp + tn), 3),
        "labels": LABELS,
        "confusion": conf,
        "latency": {
            "fast_avg_ms": fast_ms,
            "deep_avg_ms": deep_ms,
            "fast_share": round(share, 3),
            "routed_avg_ms": int(share * fast_ms + (1 - share) * deep_ms),
            "all_deep_avg_ms": deep_ms,
        },
    }
    os.makedirs(a.out, exist_ok=True)
    json.dump(result, open(os.path.join(a.out, "eval.json"), "w"), indent=2)
    with open(os.path.join(a.out, "details.csv"), "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    print(f"\nprecision {result['precision']}  recall {result['recall']}  FPR {result['false_positive_rate']}")
    print(f"→ {a.out}/eval.json (serve it from GET /eval) and {a.out}/details.csv (review the misses)")


if __name__ == "__main__":
    main()
