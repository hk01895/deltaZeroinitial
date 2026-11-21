"""
Stand-in for Person A's shared Nemotron helper. Same two functions (chat, embed).
When A's helper is ready, change the import in sharpener.py / redundancy.py and delete this file.

Setup:
    export NVIDIA_API_KEY=nvapi-...            # from build.nvidia.com
    export NEMOTRON_FAST_MODEL=<model id>      # optional: defaults to Super with thinking off
    export NEMOTRON_DEEP_MODEL=<model id>      # optional: defaults to Super
    export NEMOTRON_EMBED_MODEL=<model id>     # embedding model (default below is NVIDIA's retrieval embedder)
Uses only the standard library, so there is nothing to pip install.
"""
import json
import os
import time
import urllib.error
import urllib.request

BASE = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
# Hosted API id (NOT the Hugging Face name "NVIDIA-Nemotron-3-Super-120B-A12B-FP8", which is for self-hosting).
# One model works for both: thinking off = fast path, thinking on = deep path. Swap FAST for a smaller model later.
SUPER = "nvidia/nemotron-3-super-120b-a12b"
FAST = os.getenv("NEMOTRON_FAST_MODEL", SUPER)
DEEP = os.getenv("NEMOTRON_DEEP_MODEL", SUPER)
EMBED = os.getenv("NEMOTRON_EMBED_MODEL", "nvidia/llama-3.2-nv-embedqa-1b-v2")


def _post(path: str, payload: dict, timeout: int = 90) -> dict:
    key = os.getenv("NVIDIA_API_KEY")
    if not key:
        raise RuntimeError("NVIDIA_API_KEY not set")
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:  # show NVIDIA's own message instead of a bare "HTTP Error 410"
        raise RuntimeError(f"HTTP {e.code} from {path} (model={payload.get('model')}): {e.read().decode()[:500]}") from None


def chat(messages, model=None, thinking=False, max_tokens=1500, temperature=0.2) -> str:
    """Returns the assistant text. thinking=False -> fast model, reasoning off."""
    model = model or (DEEP if thinking else FAST)
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        # Nemotron reasoning toggle. If your model id ignores this, check its model card on build.nvidia.com
        # (some use a "/no_think" system prompt instead).
        "chat_template_kwargs": {"enable_thinking": bool(thinking)},
    }
    t0 = time.time()
    out = _post("/chat/completions", payload)
    chat.last_latency = time.time() - t0  # handy for A's latency slide
    return out["choices"][0]["message"]["content"] or ""


def embed(texts, kind="passage", batch=32):
    """kind = 'passage' for repo chunks, 'query' for the ticket text."""
    vecs = []
    for i in range(0, len(texts), batch):
        out = _post("/embeddings", {
            "model": EMBED,
            "input": texts[i:i + batch],
            "input_type": kind,
            "encoding_format": "float",
            "truncate": "END",
        })
        vecs.extend(d["embedding"] for d in sorted(out["data"], key=lambda d: d["index"]))
    return vecs


def list_models(contains="nemotron"):
    """Model ids your key can call right now (GET /models). Handy when a model id returns 404/410."""
    req = urllib.request.Request(BASE + "/models", headers={"Authorization": f"Bearer {os.getenv('NVIDIA_API_KEY')}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return sorted(m["id"] for m in json.loads(r.read())["data"] if contains in m["id"].lower())
