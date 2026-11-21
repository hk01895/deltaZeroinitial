"""Real-API check for Person D. Run from inside ticket_sharpener/:   python3 smoke_test.py
Prints PASS/FAIL per step and what to change."""
import os
import urllib.error

import llm_shim as llm


def step(name, fn):
    try:
        out = fn()
        print(f"PASS  {name}: {out}")
        return True
    except urllib.error.HTTPError as e:
        print(f"FAIL  {name}: HTTP {e.code} {e.read().decode()[:300]}")
    except Exception as e:
        print(f"FAIL  {name}: {type(e).__name__}: {e}")
    return False


if not os.getenv("NVIDIA_API_KEY"):
    raise SystemExit("Set NVIDIA_API_KEY first (build.nvidia.com -> any model -> Get API Key).")

print("fast model:", llm.FAST, "| embed model:", llm.EMBED)
step("chat, thinking OFF", lambda: llm.chat([{"role": "user", "content": "Reply with the single word: ok"}], thinking=False, max_tokens=20).strip()[:60])
print(f"      latency {getattr(llm.chat, 'last_latency', 0):.2f}s")
step("chat, thinking ON (deep model)", lambda: llm.chat([{"role": "user", "content": "What is 17*23? Answer with just the number."}], thinking=True, max_tokens=4000).strip()[-60:])
step("embeddings", lambda: f"{len(llm.embed(['hello'], kind='query')[0])} dims")


def sharpen():
    import sharpener
    r = sharpener.sharpen_ticket("Make the login page faster and more user-friendly.")
    assert not r["fallback"], "fell back to lint-only; the model call or JSON parsing failed (see [sharpener] line above)"
    return f"score {r['score']} ({r['grade']}), {len(r['issues'])} issues, rewrite {len(r['rewrite'])} chars"


step("end-to-end Sharpener", sharpen)
