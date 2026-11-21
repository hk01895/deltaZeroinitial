"""
Redundancy check: "does the codebase already do this?"
 1. index_repo(path): chunk code files, embed with the Nemotron embedding model, cache to disk.
 2. find_similar(index, ticket_text): top-k most similar chunks.
 3. judge(...): Lightning decides yes / partial / no from the top chunks (optional, falls back to a score threshold).
If embeddings fail (no key, rate limit), a keyword-overlap fallback keeps the demo alive.
"""
import json
import math
import re
from pathlib import Path

import numpy as np

import llm_shim as llm

CODE_EXT = {".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".go", ".rs", ".rb", ".cs", ".c", ".cpp", ".h", ".sql", ".md"}
SKIP_DIRS = {".git", "node_modules", "venv", ".venv", "__pycache__", "dist", "build", ".next", ".cache"}
CHUNK_LINES, OVERLAP, MAX_CHARS = 40, 10, 1800
HIT_THRESHOLD = 0.55     # cosine; tune on the demo repo (print scores for a known-duplicate ticket)
MAX_FILES = 400          # keep indexing fast for a hackathon repo


def chunk_repo(root):
    root = Path(root)
    chunks = []
    files = [p for p in root.rglob("*") if p.is_file() and p.suffix in CODE_EXT
             and not (set(p.relative_to(root).parts) & SKIP_DIRS)][:MAX_FILES]
    for p in files:
        try:
            lines = p.read_text(errors="ignore").splitlines()
        except Exception:
            continue
        step = CHUNK_LINES - OVERLAP
        for start in range(0, max(len(lines), 1), step):
            body = "\n".join(lines[start:start + CHUNK_LINES])[:MAX_CHARS]
            if len(body.strip()) < 30:
                continue
            rel = str(p.relative_to(root))
            chunks.append({"file": rel, "start": start + 1, "end": min(start + CHUNK_LINES, len(lines)), "text": body})
    return chunks


def index_repo(root, cache=True):
    """Returns {"chunks": [...], "vecs": np.ndarray | None}. vecs is None if embedding failed (keyword fallback)."""
    root = Path(root)
    cache_path = root / ".cache_deltazero_index.json"
    if cache and cache_path.exists():
        d = json.loads(cache_path.read_text())
        return {"chunks": d["chunks"], "vecs": np.array(d["vecs"]) if d["vecs"] else None}
    chunks = chunk_repo(root)
    try:
        vecs = np.array(llm.embed([f"{c['file']}\n{c['text']}" for c in chunks], kind="passage"))
    except Exception as e:
        print(f"[redundancy] embeddings unavailable ({e}); using keyword fallback")
        vecs = None
    # Only cache real embeddings; otherwise a failed first run would lock in keyword mode forever.
    if cache and vecs is not None:
        cache_path.write_text(json.dumps({"chunks": chunks, "vecs": vecs.tolist()}))
    return {"chunks": chunks, "vecs": vecs}


def _tokens(s):
    return set(re.findall(r"[a-z]{3,}", s.lower()))


def find_similar(index, ticket_text, k=3):
    chunks, vecs = index["chunks"], index["vecs"]
    if not chunks:
        return []
    scores = None
    if vecs is not None:
        try:
            q = np.array(llm.embed([ticket_text], kind="query")[0])
            scores = (vecs @ q) / (np.linalg.norm(vecs, axis=1) * np.linalg.norm(q) + 1e-9)
        except Exception as e:
            print(f"[redundancy] query embedding failed ({e}); keyword fallback")
    if scores is None:
        qt = _tokens(ticket_text)
        scores = np.array([len(qt & _tokens(c["file"] + " " + c["text"])) / (math.sqrt(len(qt) + 1) * 3) for c in chunks])
        scores = np.clip(scores, 0, 1)
    top = np.argsort(-scores)[:k]
    return [{**chunks[i], "score": round(float(scores[i]), 3)} for i in top]


JUDGE_SYSTEM = """You check whether a codebase ALREADY implements a requested ticket.
You get the ticket and the most similar code snippets. Reply with ONLY JSON:
{"already_implemented": "yes" | "partial" | "no", "file": "<best file or null>", "explanation": "<one sentence, cite the function or line>"}
Say "yes" only if a snippet clearly does what the ticket asks. If the snippets are merely related, say "no"."""


def judge(ticket_text, hits):
    """Lightning (thinking off). Returns dict or None on failure."""
    if not hits:
        return None
    ctx = "\n\n".join(f"### {h['file']}:{h['start']}-{h['end']} (similarity {h['score']})\n{h['text']}" for h in hits)
    try:
        raw = llm.chat(
            [{"role": "system", "content": JUDGE_SYSTEM},
             {"role": "user", "content": f"TICKET:\n{ticket_text}\n\nSNIPPETS:\n{ctx}"}],
            thinking=False, max_tokens=300)
        from sharpener import parse_json  # local import avoids a cycle
        return parse_json(raw)
    except Exception as e:
        print(f"[redundancy] judge failed: {e}")
        return None


def check_redundancy(index, ticket_text):
    """What the Sharpener page shows. Never raises."""
    try:
        hits = find_similar(index, ticket_text)
    except Exception as e:
        return {"status": "unknown", "error": str(e), "matches": []}
    if not hits or hits[0]["score"] < HIT_THRESHOLD:
        return {"status": "none", "matches": hits}
    verdict = judge(ticket_text, hits)
    if verdict is None:  # judge failed: fall back to similarity alone
        return {"status": "possible", "matches": hits,
                "explanation": f"Similar code found in {hits[0]['file']} (similarity {hits[0]['score']}). Review before starting."}
    status = {"yes": "exists", "partial": "partial", "no": "none"}.get(verdict.get("already_implemented"), "possible")
    return {"status": status, "matches": hits, "file": verdict.get("file"), "explanation": verdict.get("explanation")}
