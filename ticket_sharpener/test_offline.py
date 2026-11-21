"""Run with:  python3 -I test_offline.py   (from inside personD/). No API key needed: fakes the model."""
import json
import os
import tempfile
from pathlib import Path

import llm_shim

import redundancy
import rulepacks
import sharpener


# ---- fake Nemotron ----
def fake_chat(messages, **kw):
    fake_chat.calls += 1
    sys = messages[0]["content"]
    if "strict requirements reviewer" in sys:
        return "<think>hmm</think>```json\n" + json.dumps({
            "sub_scores": {"measurable": 2, "specific": 6, "testable": 3, "complete": 4},
            "issues": [{"type": "vague_word", "text": "faster", "why": "no target", "fix": "p95 < 300 ms"}],
            "rewrite": "When a user submits valid credentials, the system must respond in under [TBD] ms.",
            "acceptance_criteria": ["p95 < 300 ms at 1000 users"]}) + "\n```"
    return json.dumps({"already_implemented": "yes", "file": "auth.py", "explanation": "rate_limit() already does this"})


fake_chat.calls = 0
llm_shim.chat = fake_chat
llm_shim.embed = lambda texts, kind="passage", batch=32: (_ for _ in ()).throw(RuntimeError("no network"))  # force keyword fallback

# 1. rule packs load and trigger
assert len(rulepacks.load_pack("medical")) == 8 and len(rulepacks.load_pack("finance")) == 8
assert any(r["id"] == "FIN-01" for r in rulepacks.triggered_rules("finance", "transfer money between accounts"))
assert rulepacks.triggered_rules(None, "anything") == []
print("rule packs OK")

assert rulepacks.load_pack("../rulepacks/medical") == [] and rulepacks.load_pack("nope") == []  # no path traversal
print("sector whitelist OK")

# 2. lint catches the vague demo ticket
issues = sharpener.lint("Make the login page faster and more user-friendly. It should handle a lot of users and be secure.")
types = {i["type"] for i in issues}
assert "vague_word" in types and "missing_number" in types and "missing_acceptance" in types
print("lint OK:", [i["text"] for i in issues][:5])

# 3. sharpen with fake model: score = sum of sub-scores, <think>/fences stripped
r = sharpener.sharpen_ticket("Make login faster", sector=None)
assert r["score"] == 15 and r["grade"] == "vague" and not r["fallback"] and r["rewrite"]
assert any(i["type"] == "missing_number" for i in r["issues"]), r["issues"]  # lint gaps survive a successful model call
print("sharpen OK: score", r["score"])

# 3b. model echoes the all-zero template -> rule-based score, not 0
_orig = fake_chat
llm_shim.chat = lambda m, **k: json.dumps({"sub_scores": {"measurable": 0, "specific": 0, "testable": 0, "complete": 0},
    "issues": [], "rewrite": "x", "acceptance_criteria": []})
sharpener.llm.chat = llm_shim.chat
r = sharpener.sharpen_ticket("Make login faster")
assert r["score"] > 0 and r.get("score_note") and r["sub_scores"] is None, r
print("zero-score guard OK:", r["score"])
llm_shim.chat = _orig
sharpener.llm.chat = _orig

# 4. model failure -> lint-only fallback, no crash
llm_shim.chat = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("down"))
sharpener.llm.chat = llm_shim.chat
r = sharpener.sharpen_ticket("Make login faster", sector="finance")
assert r["fallback"] and 0 <= r["score"] <= 100
print("fallback OK: score", r["score"])
llm_shim.chat = fake_chat

# 5. redundancy with keyword fallback on a tiny repo
with tempfile.TemporaryDirectory() as d:
    Path(d, "auth.py").write_text("def rate_limit(user):\n    # lock account after 5 failed login attempts for 15 minutes\n    attempts = count_failed_logins(user)\n    if attempts >= 5:\n        lock_account(user, minutes=15)\n" * 3)
    Path(d, "billing.py").write_text("def charge(card, amount):\n    return gateway.charge(card, amount)\n" * 10)
    idx = redundancy.index_repo(d, cache=False)
    assert idx["vecs"] is None and idx["chunks"]
    hits = redundancy.find_similar(idx, "lock account after 5 failed login attempts")
    assert hits[0]["file"] == "auth.py", hits
    print("redundancy OK:", hits[0]["file"], hits[0]["score"])
print("ALL PASSED")
