#!/usr/bin/env python3
"""
Build a labeled eval set from REAL GitHub projects.

Idea: find merged pull requests that close an issue. The issue says what was
asked for (the requirement); the PR diff is what was delivered. From each
real issue + PR pair we make 3 cases with labels we can trust:

  1. met      : issue requirement + the real PR diff
  2. missing  : a DIFFERENT issue's requirement + this PR diff (clearly not implemented)
  3. missing  : this issue's requirement + the diff with all source-code hunks removed
                (only tests/docs left, so the feature itself is not there)

10 source PRs x 3 = 30 cases. Only the standard library is used.

Usage:
  export GITHUB_TOKEN=...            # optional but avoids rate limits
  python3 eval/build_cases.py --n 10 --lang python --out eval/cases.jsonl
"""
import argparse
import json
import os
import random
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://api.github.com"
TOKEN = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
MAX_DIFF_CHARS = 12000


def gh(path, accept="application/vnd.github+json"):
    req = urllib.request.Request(API + path if path.startswith("/") else path)
    req.add_header("Accept", accept)
    req.add_header("User-Agent", "deltazero-eval")
    if TOKEN:
        req.add_header("Authorization", f"Bearer {TOKEN}")
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read().decode("utf-8", "replace")
                return body if "diff" in accept else json.loads(body)
        except urllib.error.HTTPError as e:
            if e.code in (403, 429) and attempt < 3:
                wait = 20 * (attempt + 1)
                print(f"  rate limited, waiting {wait}s…", file=sys.stderr)
                time.sleep(wait)
                continue
            raise
        except (urllib.error.URLError, ConnectionError, TimeoutError, OSError) as e:
            if attempt < 3:
                time.sleep(2 * (attempt + 1))
                continue
            raise RuntimeError(f"network error: {e}") from e
    raise RuntimeError("GitHub API kept failing")


CLOSES = re.compile(r"\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)", re.I)
TEST_PATH = re.compile(r"(^|/)(tests?|spec|__tests__)/|(^|/)test_[^/]+$|_test\.\w+$|\.test\.\w+$|\.spec\.\w+$", re.I)
DOC_PATH = re.compile(r"\.(md|rst|txt|adoc)$|(^|/)docs?/|CHANGELOG|changelog", re.I)


def requirement_from_issue(issue):
    """One clear requirement sentence from an issue: title + first meaningful line."""
    title = (issue.get("title") or "").strip()
    body = issue.get("body") or ""
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    body = re.sub(r"```.*?```", "", body, flags=re.S)
    checklist = re.findall(r"^\s*[-*]\s*\[[ xX]\]\s*(.+)$", body, flags=re.M)
    lines = [l.strip(" #>*-\t") for l in body.splitlines()]
    lines = [l for l in lines if len(l) > 25 and not l.lower().startswith(("### ", "describe", "to reproduce", "environment", "version"))]
    detail = checklist[0] if checklist else (lines[0] if lines else "")
    detail = re.sub(r"\s+", " ", detail)[:220]
    return f"{title}. {detail}".strip(". ") + "." if detail else title


def split_diff(diff):
    """Split a unified diff into per-file chunks: [(path, text)]."""
    parts = re.split(r"(?=^diff --git )", diff, flags=re.M)
    out = []
    for p in parts:
        m = re.match(r"diff --git a/(\S+) b/(\S+)", p)
        if m:
            out.append((m.group(2), p))
    return out


def strip_source(diff):
    """Keep only test/doc files: the feature code itself is removed."""
    kept = [t for path, t in split_diff(diff) if TEST_PATH.search(path) or DOC_PATH.search(path)]
    return "".join(kept) if kept else "(no code changes in this diff)"


def find_sources(n, lang, seed):
    q = f"is:pr is:merged linked:issue language:{lang} comments:>0"
    sources, seen_repos = [], set()
    page = 1
    while len(sources) < n and page <= 6:
        res = gh(f"/search/issues?q={urllib.parse.quote(q)}&sort=updated&order=desc&per_page=50&page={page}")
        items = res.get("items", [])
        random.Random(seed + page).shuffle(items)
        for it in items:
            if len(sources) >= n:
                break
            repo = it["repository_url"].split("/repos/")[1]
            if repo in seen_repos:
                continue
            m = CLOSES.search(it.get("body") or "")
            if not m:
                continue
            try:
                pr = gh(f"/repos/{repo}/pulls/{it['number']}")
                if pr["additions"] + pr["deletions"] > 400 or pr["changed_files"] > 8:
                    continue
                files = gh(f"/repos/{repo}/pulls/{it['number']}/files?per_page=20")
                if not any(not TEST_PATH.search(f["filename"]) and not DOC_PATH.search(f["filename"]) for f in files):
                    continue
                issue = gh(f"/repos/{repo}/issues/{m.group(1)}")
                if issue.get("pull_request") or len(issue.get("body") or "") < 60:
                    continue
                diff = gh(f"/repos/{repo}/pulls/{it['number']}", accept="application/vnd.github.v3.diff")
            except Exception as e:  # noqa: BLE001
                print(f"  skip {repo}#{it['number']}: {e}", file=sys.stderr)
                continue
            seen_repos.add(repo)
            sources.append(
                {
                    "repo": repo,
                    "pr": it["number"],
                    "pr_url": it["html_url"],
                    "issue": int(m.group(1)),
                    "issue_url": issue["html_url"],
                    "requirement": requirement_from_issue(issue),
                    "diff": diff[:MAX_DIFF_CHARS],
                }
            )
            print(f"  ✓ {repo}#{it['number']} closes #{m.group(1)}", file=sys.stderr)
        page += 1
    return sources


def build_cases(sources, seed):
    rnd = random.Random(seed)
    cases = []
    for i, s in enumerate(sources):
        other = sources[(i + 1 + rnd.randrange(max(1, len(sources) - 1))) % len(sources)]
        if other is s:
            other = sources[(i + 1) % len(sources)]
        base = {"repo": s["repo"], "pr_url": s["pr_url"], "issue_url": s["issue_url"]}
        cases.append({**base, "id": f"{i+1:02d}-met", "kind": "real_pr", "requirement": s["requirement"], "diff": s["diff"], "label": "met"})
        cases.append({**base, "id": f"{i+1:02d}-swap", "kind": "other_issue_requirement", "requirement": other["requirement"], "diff": s["diff"], "label": "missing"})
        cases.append({**base, "id": f"{i+1:02d}-strip", "kind": "feature_code_removed", "requirement": s["requirement"], "diff": strip_source(s["diff"]), "label": "missing"})
    return cases


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=10, help="number of real PRs (3 cases each)")
    ap.add_argument("--lang", default="python")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", default="eval/cases.jsonl")
    a = ap.parse_args()

    print(f"Finding {a.n} merged {a.lang} PRs that close an issue…", file=sys.stderr)
    sources = find_sources(a.n, a.lang, a.seed)
    if len(sources) < 2:
        sys.exit("Not enough sources found. Try another --lang or set GITHUB_TOKEN.")
    cases = build_cases(sources, a.seed)
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    with open(a.out, "w") as f:
        for c in cases:
            f.write(json.dumps(c) + "\n")
    with open(os.path.join(os.path.dirname(a.out) or ".", "sources.json"), "w") as f:
        json.dump([{k: v for k, v in s.items() if k != "diff"} for s in sources], f, indent=2)
    print(f"Wrote {len(cases)} cases from {len(sources)} real PRs → {a.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
