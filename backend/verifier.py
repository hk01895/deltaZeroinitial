"""
Verifier: plugs Shreenidhi's AI engine (ai_engine/engine.py) into Shreya's backend.

main.run_verification() calls verify(pr_id, head_sha, diff, requirements) and expects
{"verdicts": [...]} with one verdict per requirement in the backend's vocabulary:
    covered | partial | none | human
Extra keys (reasoning, thinking, downgraded_from, evidence_locations) are passed
through for the dashboard.
"""
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for p in (ROOT / "ai_engine", ROOT / "ticket_sharpener"):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

import engine  # noqa: E402  (Shreenidhi)

try:
    import rulepacks  # noqa: E402  (Nimalan)
except Exception:  # yaml missing etc. -> run without sector rules
    rulepacks = None

TO_BACKEND = {"FULFILLED": "covered", "PARTIAL": "partial", "NOT_VERIFIED": "none", "HUMAN_REVIEW": "human"}
HIGH_STAKES = re.compile(r"\b(audit|encrypt|password|payment|money|transfer|dosing|dose|patient data|security|auth)", re.I)


def _feedback(requirements):
    """Recent human overrides become examples in the prompt (the AI learns from corrections)."""
    try:
        import db

        with db.conn() as c:
            rows = c.execute(
                """
                SELECT o.original_verdict AS ai_verdict, o.new_verdict AS correct_verdict, o.reason,
                       COALESCE(r.text, o.req_id) AS requirement
                FROM overrides o LEFT JOIN requirements r ON r.req_id = o.req_id
                ORDER BY o.id DESC LIMIT 5
                """
            ).fetchall()
        return engine.format_feedback_examples([dict(r) for r in reversed(rows)])
    except Exception:
        return ""


def locate(diff, lines):
    """Map quoted evidence lines to (file, line number in the new file)."""
    want = [l.strip() for l in lines if isinstance(l, str) and l.strip()]
    found, file, n = [], None, 0
    for raw in diff.splitlines():
        if raw.startswith("+++ "):
            file = raw[6:] if raw.startswith("+++ b/") else raw[4:]
            continue
        m = re.match(r"@@ -\d+(?:,\d+)? \+(\d+)", raw)
        if m:
            n = int(m.group(1))
            continue
        if raw.startswith(("---", "diff --git", "index ")):
            continue
        if raw.startswith("-"):
            continue
        text = raw[1:] if raw[:1] in ("+", " ") else raw
        if text.strip() in want and not any(f["code"] == text.strip() for f in found):
            found.append({"file": file or "diff", "line": n, "code": text.strip()})
        n += 1
    return found


def verify(pr_id, head_sha, diff, requirements):
    sector = next((r.get("sector") for r in requirements if r.get("sector")), None)
    sector_rules = rulepacks.format_for_prompt(sector) if (rulepacks and sector) else ""
    feedback = _feedback(requirements)

    def check(r):
        high = bool(HIGH_STAKES.search(r["text"])) or bool(sector_rules and rulepacks.triggered_rules(sector, r["text"]))
        try:
            review = engine.timed_router(r["req_id"], r["text"], diff, high_stakes=high,
                                         feedback_examples=feedback, sector_rules=sector_rules)
        except Exception as e:  # never break the whole PR check on one requirement
            review = {"req_id": r["req_id"], "verdict": "HUMAN_REVIEW", "confidence": 0.0, "evidence_lines": [],
                      "reasoning": f"AI check failed ({e}); a person needs to look.", "suggested_diff": "",
                      "suggested_test": "", "model_used": "lightning", "thinking": False, "latency_ms": 0}
        return {
            "req_id": r["req_id"],
            "verdict": TO_BACKEND.get(review["verdict"], "human"),
            "confidence": review.get("confidence", 0.0),
            "evidence_lines": review.get("evidence_lines", []),
            "suggested_diff": review.get("suggested_diff", ""),
            "suggested_test": review.get("suggested_test", ""),
            "model_used": review.get("model_used", "lightning"),
            "latency_ms": review.get("latency_ms", 0),
            # extras for the dashboard
            "reasoning": review.get("reasoning", ""),
            "thinking": review.get("thinking", False),
            "downgraded_from": TO_BACKEND.get(review.get("downgraded_from") or "", None),
            "evidence_locations": locate(diff, review.get("evidence_lines", [])),
            "claimed_evidence": review.get("evidence_lines", []),
        }

    # Check every requirement at the same time (Nemotron calls run in parallel), keep the order.
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=min(8, max(1, len(requirements)))) as pool:
        verdicts = list(pool.map(check, requirements))
    try:  # keep reasoning + evidence locations for the dashboard (/ui/*)
        import ui_api

        ui_api.save_extras(pr_id, head_sha, verdicts)
    except Exception as e:
        print("[verifier] could not save dashboard extras:", e)
    return {"verdicts": verdicts}
