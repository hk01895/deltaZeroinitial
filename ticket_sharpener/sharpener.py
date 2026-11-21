"""
Ticket Sharpener: precision score (0-100) + problems + rewrite.
Flow: cheap deterministic lint -> Nemotron Lightning (thinking off) scores + rewrites -> merge.
The final score is computed in code from the model's sub-scores, so it is stable and explainable on stage.
"""
import json
import re

import llm_shim as llm
import rulepacks

VAGUE_WORDS = [
    "fast", "faster", "quick", "quickly", "slow", "easy", "easily", "simple", "user-friendly", "intuitive",
    "robust", "scalable", "secure", "efficient", "better", "improve", "improved", "optimize", "optimise",
    "appropriate", "properly", "as needed", "etc", "and so on", "some", "several", "many", "large", "small",
    "soon", "modern", "seamless", "flexible", "reasonable", "should be able to", "support", "handle", "good",
]
PERF_WORDS = ["fast", "quick", "slow", "latency", "timeout", "large", "many", "limit", "scale", "load", "speed"]


def lint(ticket):
    """Deterministic checks. Always works, even with no API."""
    issues = []
    low = ticket.lower()
    for w in VAGUE_WORDS:
        m = re.search(rf"\b{re.escape(w)}\b", low)
        if m:
            issues.append({"type": "vague_word", "text": ticket[m.start():m.end()],
                           "why": "Vague: two people would read this differently.",
                           "fix": "Replace with a measurable target (a number, a limit, or a named behavior)."})
    if not re.search(r"\d", ticket):
        issues.append({"type": "missing_number", "text": "(no numbers anywhere)",
                       "why": "No number means nothing to test against.",
                       "fix": "Add the threshold, limit, count, or time that defines done."})
    elif any(re.search(rf"\b{w}", low) for w in PERF_WORDS) and not re.search(r"\d+\s*(ms|s|sec|seconds|%|rps|req|users|mb|gb|kb|minutes|min|hours|days)\b", low):
        issues.append({"type": "missing_number", "text": "(performance claim with no unit)",
                       "why": "Performance or size is mentioned without a measurable limit.",
                       "fix": "State it as e.g. 'p95 under 300 ms for 1,000 concurrent users'."})
    if not re.search(r"\b(when|if|given|must|shall|returns?|displays?|rejects?|sends?|blocks?|locks?)\b", low):
        issues.append({"type": "missing_acceptance", "text": "(no testable behavior)",
                       "why": "Nothing says what the system does or when.",
                       "fix": "Write at least one 'when X, the system must Y' statement."})
    return issues


SYSTEM = """You are a strict requirements reviewer. You judge how PRECISE a software ticket is: could two engineers
build it and a tester verify it without asking questions?

Score four sub-scores, each an integer 0-25:
- measurable: numbers, limits, thresholds, units instead of vague words
- specific: named inputs, outputs, users, systems, error cases
- testable: a tester could write a pass/fail test from the text alone
- complete: states scope, edge cases, failure behavior, and who/what is affected

Then list problems. Each problem MUST quote the exact phrase from the ticket in "text" (or "(missing)" if something is absent),
say why it is a problem, and give a concrete fix.

Then rewrite the ticket so it is precise. RULES FOR THE REWRITE:
- Keep the original intent. Do not invent business facts. Where a number is needed but unknown, write a clearly marked
  placeholder like [TBD: target p95 latency in ms] instead of guessing.
- Use short "The system must ..." / "When X, the system must Y" sentences, one requirement per line.
- Also return acceptance_criteria: 2-5 pass/fail checks a tester could run.

Reply with ONLY this JSON, no other text:
{"sub_scores":{"measurable":0,"specific":0,"testable":0,"complete":0},
 "issues":[{"type":"vague_word|missing_number|missing_acceptance|ambiguous_scope|missing_edge_case|sector_gap","text":"","why":"","fix":""}],
 "rewrite":"",
 "acceptance_criteria":[""]}"""


def parse_json(raw):
    """Tolerant JSON extraction: strips <think> blocks and code fences, grabs the first {...}."""
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.S)
    raw = re.sub(r"```(?:json)?", "", raw)
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("no JSON object in model output")
    return json.loads(raw[start:end + 1])


def heuristic_score(issues):
    """Fallback when the model is unreachable."""
    penalty = {"vague_word": 8, "missing_number": 20, "missing_acceptance": 20}
    return max(0, 100 - sum(penalty.get(i["type"], 5) for i in issues))


def grade(score):
    return "precise" if score >= 80 else "needs work" if score >= 50 else "vague"


def sharpen_ticket(ticket, sector=None, redundancy=None):
    """
    ticket: raw ticket text. sector: 'medical' | 'finance' | None.
    redundancy: optional dict from redundancy.check_redundancy (so the API can attach it).
    Returns a dict ready to JSON-serialize for the page. Never raises: on model failure falls back to lint only.
    """
    ticket = ticket.strip()
    lint_issues = lint(ticket)
    sector_rules = rulepacks.triggered_rules(sector, ticket)

    user_msg = f"TICKET:\n{ticket}"
    if sector_rules:
        user_msg += "\n\n" + rulepacks.format_for_prompt(sector, only=sector_rules)
        user_msg += ("\n\nFor each sector rule above that the ticket does not address, add an issue of type 'sector_gap' "
                     "naming the rule id, and add the missing requirement to the rewrite.")
    user_msg += f"\n\nDETERMINISTIC LINT FOUND: {json.dumps([i['text'] for i in lint_issues])}"

    result = {"model_used": "lightning", "fallback": False}
    try:
        raw = llm.chat([{"role": "system", "content": SYSTEM}, {"role": "user", "content": user_msg}],
                       thinking=False, max_tokens=1400)
        data = parse_json(raw)
        subs = {k: max(0, min(25, int(data["sub_scores"].get(k, 0)))) for k in ("measurable", "specific", "testable", "complete")}
        score = sum(subs.values())
        # Merge: model issues first, then any lint issue whose quoted text the model did not already cover.
        issues = list(data.get("issues", []))
        covered = " ".join(i.get("text", "").lower() for i in issues)
        issues += [i for i in lint_issues if i["text"].lower() not in covered and not i["text"].startswith("(")]
        result.update(sub_scores=subs, rewrite=data.get("rewrite", ""),
                      acceptance_criteria=data.get("acceptance_criteria", []), latency_s=round(getattr(llm.chat, "last_latency", 0), 2))
    except Exception as e:
        print(f"[sharpener] model failed, lint-only fallback: {e}")
        issues, score = lint_issues, heuristic_score(lint_issues)
        result.update(fallback=True, sub_scores=None, rewrite="", acceptance_criteria=[],
                      note="AI unavailable: showing rule-based checks only.")

    result.update(score=score, grade=grade(score), issues=issues,
                  sector=sector, sector_rules_checked=[r["id"] for r in sector_rules])
    if redundancy is not None:
        result["redundancy"] = redundancy
    return result
