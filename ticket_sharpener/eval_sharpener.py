"""Run:  python3 eval_sharpener.py     (needs NVIDIA_API_KEY for the Nemotron column; rules-only baseline always runs)
Measures how well the Sharpener tells precise tickets from imprecise ones.
Positive class = 'imprecise' (grade is not 'precise'), the thing we want to catch before work starts."""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from key import KEY
    os.environ.setdefault("NVIDIA_API_KEY", KEY)
except ImportError:
    pass

import sharpener
from eval_tickets import CASES


def metrics(rows):
    tp = sum(1 for e, g in rows if e != "precise" and g != "precise")   # imprecise, flagged
    fp = sum(1 for e, g in rows if e == "precise" and g != "precise")   # precise, wrongly flagged
    fn = sum(1 for e, g in rows if e != "precise" and g == "precise")   # imprecise, missed
    tn = sum(1 for e, g in rows if e == "precise" and g == "precise")
    exact = sum(1 for e, g in rows if e == g)
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    fpr = fp / (fp + tn) if fp + tn else 0.0
    return {"n": len(rows), "exact_grade": exact / len(rows), "precision": prec, "recall": rec, "false_positive_rate": fpr}


def show(name, m):
    print(f"{name:<22} exact grade {m['exact_grade']:.0%} | precision {m['precision']:.0%} | recall {m['recall']:.0%} | false-positive rate {m['false_positive_rate']:.0%}  (n={m['n']})")


baseline, model, failed = [], [], 0
for c in CASES:
    base = sharpener.grade(sharpener.heuristic_score(sharpener.lint(c["ticket"])))
    baseline.append((c["expected"], base))
    r = sharpener.sharpen_ticket(c["ticket"], c["sector"])
    if r["fallback"]:
        failed += 1
        continue
    model.append((c["expected"], r["grade"]))
    flag = "" if r["grade"] == c["expected"] else "   <-- MISMATCH"
    print(f"[{c['expected']:<10} -> {r['grade']:<10} {r['score']:>3}] {c['ticket'][:60]!r}{flag}")

print()
show("Rules only (baseline)", metrics(baseline))
if model:
    show("Nemotron + rules", metrics(model))
if failed:
    print(f"WARNING: {failed} ticket(s) fell back to rules-only (API error), excluded from the Nemotron row.")
