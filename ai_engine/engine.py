"""
DeltaZero AI engine (Person A, Shreenidhi).

Ported from her Colab notebook (ai_engine/deltazero_colab.py) into an importable
module: same prompts, same Lightning -> Super escalation, same Evidence Guard,
same "learn from human corrections" idea. Changes from the notebook:
  * no google.colab / openai dependency (reads NVIDIA_API_KEY from the env, stdlib HTTP)
  * no code runs at import time
  * tolerant JSON parsing (models sometimes wrap JSON in ``` or <think>)
  * Evidence Guard understands unified diffs (+/- prefixes)
  * corrections come from the backend's overrides table instead of a CSV
  * regenerate_fix(): rewrite a suggested fix from reviewer feedback (UI "Not the fix you want?")

Set DELTAZERO_FAKE_LLM=1 to run without an API key (deterministic fake answers for demos/tests).
"""
from __future__ import annotations

import json
import os
import re
import time
import urllib.error
import urllib.request

BASE_URL = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
LIGHTNING = os.getenv("NEMOTRON_FAST_MODEL", "nvidia/nemotron-3.5-lightning-30b-a3b")
SUPER = os.getenv("NEMOTRON_DEEP_MODEL", "nvidia/nemotron-3.5-super-vl-120b-a12b")
ESCALATE_BELOW = float(os.getenv("DELTAZERO_ESCALATE_BELOW", "0.8"))

VERDICTS = ("FULFILLED", "PARTIAL", "NOT_VERIFIED", "HUMAN_REVIEW")


# ---------------------------------------------------------------------------
# Nemotron call


def _fake() -> bool:
    return os.getenv("DELTAZERO_FAKE_LLM", "").lower() in ("1", "true", "yes")


def nemotron(prompt: str, model: str, thinking: bool | None = None) -> str:
    """One chat completion. thinking defaults to on for Super, off for Lightning."""
    if _fake():
        return _fake_answer(prompt, model)
    key = os.getenv("NVIDIA_API_KEY")
    if not key:
        raise RuntimeError("NVIDIA_API_KEY is not set (or set DELTAZERO_FAKE_LLM=1 for offline demo mode)")
    if thinking is None:
        thinking = model == SUPER
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.2,
        "max_tokens": 4096,
        "stream": False,
        "chat_template_kwargs": {"enable_thinking": bool(thinking)},
    }
    req = urllib.request.Request(
        BASE_URL + "/chat/completions",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            out = json.loads(r.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Nemotron HTTP {e.code} (model={model}): {e.read().decode()[:400]}") from None
    text = (out["choices"][0]["message"].get("content") or "").strip()
    if not text:
        raise ValueError(f"Nemotron returned no final text (model={model}).")
    return text


def parse_json(raw: str) -> dict:
    """Strip <think> blocks and ``` fences, then parse the first {...} object."""
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.S)
    raw = re.sub(r"```(?:json)?", "", raw)
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object in model output")
    return json.loads(raw[start : end + 1])


# ---------------------------------------------------------------------------
# Review one requirement (her prompt, plus a one-sentence reason and sector rules)


def review_code(req_id, requirement, code, model, feedback_examples="", sector_rules=""):
    prompt = f"""
    You are DeltaZero, an AI code reviewer.

    Your job is to compare a project requirement
    against the code provided by a developer.

    REQUIREMENT ID:
    {req_id}

    REQUIREMENT:
    {requirement}

    DEVELOPER CODE (a unified diff: lines starting with + were added):
    {code}

    Check whether the code meets the requirement.

    PREVIOUS HUMAN CORRECTIONS:
    {feedback_examples or "(none yet)"}

    {sector_rules}

    Respond with ONLY valid JSON containing:
    - req_id: the requirement ID
    - verdict: FULFILLED, PARTIAL, NOT_VERIFIED,
      or HUMAN_REVIEW
    - confidence: a number between 0 and 1
    - reasoning: ONE plain-English sentence explaining the verdict
    - evidence_lines: exact lines from the code
      supporting your decision (copy them without the leading + or -)
    - suggested_diff: suggested changes to the code as a unified diff
      (empty string if nothing is needed)
    - suggested_test: a test to check the requirement

    Rules:
    - Do not invent code that isn't provided.
    - If the code only meets part of the requirement,
      use PARTIAL.
    - If the provided code does not demonstrate the
      requirement, use NOT_VERIFIED.
    - If you cannot determine the answer from the
      provided code, use HUMAN_REVIEW.
    - Return JSON only, without markdown formatting.
    """
    return nemotron(prompt, model)


# ---------------------------------------------------------------------------
# Evidence Guard (hers, diff-aware)


def _code_lines(code: str) -> list[str]:
    out = []
    for line in code.splitlines():
        if line.startswith(("+++", "---", "@@", "diff --git", "index ")):
            continue
        if line[:1] in ("+", "-", " "):
            line = line[1:]
        out.append(line.strip())
    return out


def evidence_guard(review: dict, code: str) -> dict:
    """The model must quote real lines from the code. If it can't, a human checks."""
    code_lines = set(_code_lines(code))
    evidence = review.get("evidence_lines", [])
    original = review.get("verdict")

    def downgrade():
        if original != "HUMAN_REVIEW":
            review["downgraded_from"] = original
        review["verdict"] = "HUMAN_REVIEW"
        review["confidence"] = 0.0
        return review

    if review.get("verdict") == "HUMAN_REVIEW":
        return review
    # NOT_VERIFIED means "it isn't there", so there may be nothing to quote.
    if review.get("verdict") == "NOT_VERIFIED" and not evidence:
        return review
    if not isinstance(evidence, list) or not evidence:
        return downgrade()
    for line in evidence:
        if not isinstance(line, str) or line.strip().lstrip("+-").strip() not in code_lines:
            return downgrade()
    review["evidence_lines"] = [l.strip().lstrip("+-").strip() for l in evidence]
    return review


# ---------------------------------------------------------------------------
# Router: Lightning first, escalate to Super when unsure (hers)


def _clean(review: dict, req_id: str) -> dict:
    review["req_id"] = req_id
    v = str(review.get("verdict", "HUMAN_REVIEW")).upper().replace(" ", "_")
    review["verdict"] = v if v in VERDICTS else "HUMAN_REVIEW"
    try:
        review["confidence"] = max(0.0, min(1.0, float(review.get("confidence", 0))))
    except (TypeError, ValueError):
        review["confidence"] = 0.0
    for k in ("suggested_diff", "suggested_test", "reasoning"):
        val = review.get(k) or ""
        review[k] = "\n".join(map(str, val)) if isinstance(val, list) else str(val)
    if not isinstance(review.get("evidence_lines"), list):
        review["evidence_lines"] = []
    return review


def router(req_id, requirement, code, high_stakes=False, feedback_examples="", sector_rules=""):
    model = SUPER if high_stakes else LIGHTNING
    review = _clean(parse_json(review_code(req_id, requirement, code, model, feedback_examples, sector_rules)), req_id)
    review = evidence_guard(review, code)

    if model == LIGHTNING and (review["confidence"] < ESCALATE_BELOW or review["verdict"] == "HUMAN_REVIEW"):
        model = SUPER
        review = _clean(parse_json(review_code(req_id, requirement, code, model, feedback_examples, sector_rules)), req_id)
        review = evidence_guard(review, code)
        review["escalated"] = True

    review["model_used"] = "super" if model == SUPER else "lightning"
    review["thinking"] = model == SUPER
    return review


def timed_router(req_id, requirement, code, high_stakes=False, feedback_examples="", sector_rules=""):
    start = time.perf_counter()
    review = router(req_id, requirement, code, high_stakes, feedback_examples, sector_rules)
    review["latency_ms"] = int((time.perf_counter() - start) * 1000)
    return review


# ---------------------------------------------------------------------------
# Spec splitter (hers)


def split_requirements(spec_text: str) -> dict:
    prompt = f"""
    You are DeltaZero's requirements splitter.

    Your job is to read a software project description
    and split it into individual requirements.

    PROJECT DESCRIPTION:
    {spec_text}

    Instructions:
    1. Identify each distinct requirement.
    2. Give every requirement a unique ID:
       REQ-001, REQ-002, REQ-003, etc.
    3. Each requirement should describe one
       specific feature or behavior.
    4. Keep requirements clear and concise.
    5. Do not invent requirements that aren't
       mentioned in the description.
    6. Preserve important conditions and constraints.
    7. Return ONLY valid JSON.

    Use this exact JSON structure:

    {{
        "requirements": [
            {{
                "req_id": "REQ-001",
                "requirement": "First requirement"
            }}
        ]
    }}
    """
    return parse_json(nemotron(prompt, SUPER))


# ---------------------------------------------------------------------------
# Learning from human corrections (hers, fed from the overrides table)


def format_feedback_examples(rows, limit=3) -> str:
    """rows: dicts with requirement, ai_verdict, correct_verdict, reason (most recent last)."""
    examples = ""
    for row in list(rows)[-limit:]:
        examples += f"""
        Previous human correction:

        Requirement: {row.get('requirement', '')}
        AI originally said: {row.get('ai_verdict', '')}
        Human corrected it to: {row.get('correct_verdict', '')}
        Reason: {row.get('reason', '')}
        """
    return examples


# ---------------------------------------------------------------------------
# "Not the fix you want?": rewrite a suggested fix from reviewer feedback


def regenerate_fix(req_id, requirement, code, previous_diff, feedback) -> dict:
    prompt = f"""
    You are DeltaZero, an AI code reviewer. A reviewer did not like your suggested fix.

    REQUIREMENT ({req_id}): {requirement}

    DEVELOPER CODE (unified diff):
    {code}

    YOUR PREVIOUS SUGGESTED FIX:
    {previous_diff or "(none)"}

    WHAT THE REVIEWER WANTS INSTEAD:
    {feedback}

    Write a NEW fix that meets the requirement AND follows the reviewer's instructions.
    Do not repeat the previous fix. Do not invent files that are not in the diff unless needed.
    Respond with ONLY valid JSON:
    {{"suggested_diff": "<unified diff>", "suggested_test": "<test code>", "note": "<one sentence on what changed>"}}
    """
    data = parse_json(nemotron(prompt, SUPER))
    return {
        "suggested_diff": str(data.get("suggested_diff", "")),
        "suggested_test": str(data.get("suggested_test", "")),
        "note": str(data.get("note") or f'Rewritten using your feedback: "{feedback}"'),
    }


# ---------------------------------------------------------------------------
# Match requirements to tickets (GitHub issues) when loading a real project


def _norm(t: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9 ]+", " ", (t or "").lower()).split())


def match_requirements(requirements, issues) -> dict:
    """requirements: [{req_id, text}]; issues: [{key, title, body}] -> {req_id: issue key or None}.

    Nemotron Super (thinking on) picks the ticket AND quotes the line in it that asks for the behavior.
    Like Evidence Guard: a match only counts if that quote really is in the ticket. Anything else is lost.
    """
    if not requirements or not issues:
        return {r["req_id"]: None for r in requirements}
    reqs = "\n".join(f"{r['req_id']}: {r['text']}" for r in requirements)
    iss = "\n".join(f"{i['key']}: {i['title']}\n{(i.get('body') or '')[:1200]}\n---" for i in issues[:60])
    prompt = f"""
    You are DeltaZero's ticket matcher.

    For each REQUIREMENT, find the ONE ticket (GitHub issue) that explicitly asks for that exact behavior,
    and copy the exact line from that ticket (its title or body) that asks for it.
    Be strict. A ticket on a related topic is NOT a match: the quoted line itself must describe this specific
    behavior (for example, a line about booking does not cover rescheduling, and a line about cancelling
    does not cover audit logging). If no line in any ticket asks for it, use null.
    Missing a match is far better than a wrong match: unmatched requirements are flagged as lost.
    Several requirements may match the same ticket.

    REQUIREMENTS:
    {reqs}

    TICKETS:
    {iss}

    Return ONLY valid JSON:
    {{"matches": {{"REQ-001": {{"ticket": "#12", "quote": "exact line copied from ticket #12"}}, "REQ-002": null}}}}
    """
    m = {}
    for model, thinking in ((SUPER, True), (LIGHTNING, False)):
        try:
            data = parse_json(nemotron(prompt, model, thinking=thinking))
            m = data.get("matches", {}) if isinstance(data, dict) else {}
            break
        except Exception:
            continue
    text_of = {i["key"]: _norm(f"{i['title']}\n{i.get('body') or ''}") for i in issues}

    # Words that set a requirement apart from the others ("reschedule", "audit"), not shared ones
    # ("patients", "appointment"). The quoted ticket line must contain at least one of them.
    filler = {"with", "when", "that", "this", "from", "they", "their", "them", "have", "will", "shall", "must",
              "should", "every", "each", "into", "over", "only", "also", "than", "then", "before", "after", "about",
              "what", "which", "there", "where", "while", "able", "user", "users", "system", "make", "sure", "does",
              "done", "need", "needs", "more", "less", "some", "such", "other", "their", "your", "would", "could"}
    stems = lambda t: {w[:5] for w in _norm(t).split() if len(w) >= 4 and w not in filler}
    req_stems = {r["req_id"]: stems(r["text"]) for r in requirements}
    df = {}
    for ss in req_stems.values():
        for w in ss:
            df[w] = df.get(w, 0) + 1
    out = {}
    for r in requirements:
        v = m.get(r["req_id"])
        key, quote = (v.get("ticket"), v.get("quote")) if isinstance(v, dict) else (v, None)
        q = _norm(quote or "")
        ok = key in text_of and len(q.split()) >= 2 and q in text_of[key]
        own = {w for w in req_stems[r["req_id"]] if df[w] == 1}
        if ok and own and not (own & stems(q)):
            ok = False  # the quote is about something related, not this requirement
        out[r["req_id"]] = key if ok else None
    return out


# ---------------------------------------------------------------------------
# Offline fake (DELTAZERO_FAKE_LLM=1): simple keyword overlap so demos run without a key


def _fake_answer(prompt: str, model: str) -> str:
    if "ticket matcher" in prompt:
        reqs = re.findall(r"^\s*(REQ-\d+): (.+)$", prompt.split("REQUIREMENTS:")[1].split("TICKETS:")[0], re.M)
        block = prompt.split("TICKETS:")[1].split("Return ONLY")[0]
        lines = []  # (ticket key, line)
        for chunk in block.split("\n---"):
            mm = re.search(r"(#\d+): (.+)", chunk)
            if mm:
                key = mm.group(1)
                lines += [(key, l.strip(" -*\t")) for l in [mm.group(2)] + chunk.split(mm.group(0), 1)[1].splitlines() if l.strip()]
        matches = {}
        for rid, text in reqs:
            words = {w for w in re.findall(r"[a-z]{4,}", text.lower())}
            best = max(lines, key=lambda t: len(words & set(re.findall(r"[a-z]{4,}", t[1].lower()))), default=None)
            score = len(words & set(re.findall(r"[a-z]{4,}", best[1].lower()))) if best else 0
            matches[rid] = {"ticket": best[0], "quote": best[1]} if best and score >= 2 else None
        return json.dumps({"matches": matches})
    if "requirements splitter" in prompt:
        desc = prompt.split("PROJECT DESCRIPTION:")[1].split("Instructions:")[0]
        items = [l.strip(" -*\t") for l in desc.splitlines() if len(l.strip(" -*\t")) > 8 and not l.strip().startswith("#")]
        return json.dumps({"requirements": [{"req_id": f"REQ-{i+1:03d}", "requirement": t} for i, t in enumerate(items)]})
    if "A reviewer did not like your suggested fix" in prompt:
        fb = prompt.split("WHAT THE REVIEWER WANTS INSTEAD:")[1].split("Write a NEW fix")[0].strip()
        return json.dumps({"suggested_diff": f"# Reviewer asked: {fb}\n+ # (fake mode) rewritten fix", "suggested_test": "def test_fix():\n    assert True", "note": f'Rewritten using your feedback: "{fb}"'})
    req_id = prompt.split("REQUIREMENT ID:")[1].split("REQUIREMENT:")[0].strip()
    requirement = prompt.split("REQUIREMENT:")[1].split("DEVELOPER CODE")[0].strip()
    code = prompt.split("DEVELOPER CODE (a unified diff: lines starting with + were added):")[1].split("Check whether")[0]
    added = [l[1:].strip() for l in code.splitlines() if l.startswith("+") and not l.startswith("+++")]
    words = {w for w in re.findall(r"[a-z]{4,}", requirement.lower())}
    hits = [l for l in added if any(w in l.lower() for w in words)]
    ratio = len({w for w in words if any(w in l.lower() for l in added)}) / max(1, len(words))
    verdict = "FULFILLED" if ratio >= 0.5 and hits else "PARTIAL" if hits else "NOT_VERIFIED"
    conf = 0.9 if model == SUPER else (0.85 if verdict != "PARTIAL" else 0.6)
    return json.dumps({
        "req_id": req_id, "verdict": verdict, "confidence": conf,
        "reasoning": f"(fake mode) {len(hits)} added line(s) mention the requirement's key words.",
        "evidence_lines": hits[:3],
        "suggested_diff": "" if verdict == "FULFILLED" else f"+ # TODO: implement {requirement[:60]}",
        "suggested_test": "" if verdict == "FULFILLED" else "def test_requirement():\n    ...",
    })
