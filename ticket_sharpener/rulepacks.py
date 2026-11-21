"""Loads the sector rule packs (YAML). Used by the Sharpener (me) and the Verifier prompt (Person A)."""
import re
from pathlib import Path

import yaml

PACK_DIR = Path(__file__).parent / "rulepacks"


def available_sectors():
    return sorted(p.stem for p in PACK_DIR.glob("*.yaml"))


def load_pack(sector):
    """sector: 'medical' | 'finance' | None/'general' -> list of rule dicts ([] if none)."""
    # Whitelist: the sector comes from an HTTP request, so never build a file path from it directly.
    if not sector or sector not in available_sectors():
        return []
    return yaml.safe_load((PACK_DIR / f"{sector}.yaml").read_text())["rules"]


def triggered_rules(sector, text):
    """Rules whose trigger words appear in the text (word-boundary match, case-insensitive)."""
    t = text.lower()
    hits = []
    for r in load_pack(sector):
        if any(re.search(rf"\b{re.escape(w)}", t) for w in r.get("triggers", [])):
            hits.append(r)
    return hits


def format_for_prompt(sector, only=None):
    """Plain-text block to paste into any prompt. Person A: call format_for_prompt(sector) in the verifier."""
    rules = only if only is not None else load_pack(sector)
    if not rules:
        return ""
    lines = [f"SECTOR RULES ({sector}). For each rule that applies to this change, also report a verdict with code evidence:"]
    for r in rules:
        lines.append(f"- [{r['id']}] {r['title']}: {r['check']} (severity: {r['severity']})")
    return "\n".join(lines)
