"""
/ui/* : adapter between Shreya's backend (tables + GitHub + verification) and the
web dashboard's JSON contract (docs/api-contract.md, web/lib/types.ts).

Nothing here changes the existing endpoints. It reads the same SQLite tables, calls
the same run_verification(), Nimalan's sharpener and Shreenidhi's engine.
Mounted in main.py with: app.include_router(ui_api.router)
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

import db
import github

ROOT = Path(__file__).resolve().parent.parent
for p in (ROOT / "ai_engine", ROOT / "ticket_sharpener"):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

import engine  # noqa: E402

router = APIRouter(prefix="/ui", tags=["dashboard"])

PROJECT = os.getenv("DELTAZERO_PROJECT", "No project loaded")
SPEC_NAME = os.getenv("DELTAZERO_SPEC_NAME", "spec.md")
TICKET_PREFIX = os.getenv("TICKET_PREFIX", "DZ")
TICKET_URL = os.getenv("TICKET_URL_BASE", "")  # e.g. https://yourteam.atlassian.net/browse
TICKET_KEY = re.compile(r"\b([A-Z][A-Z0-9]+-\d+)\b")

TO_UI = {"covered": "met", "partial": "partial", "none": "missing", "human": "needs_human"}
TO_BACKEND = {v: k for k, v in TO_UI.items()}
HIGH = re.compile(r"\b(audit|encrypt|password|payment|money|transfer|dosing|dose|patient|security|auth)", re.I)


def _init():
    with db.conn() as c:
        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS pr_meta (
                pr_id TEXT PRIMARY KEY, number INTEGER, title TEXT, url TEXT, branch TEXT
            );
            CREATE TABLE IF NOT EXISTS verdict_extras (
                pr_id TEXT, head_sha TEXT, req_id TEXT, data TEXT,
                PRIMARY KEY (pr_id, head_sha, req_id)
            );
            CREATE TABLE IF NOT EXISTS project (
                id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT, repo TEXT, spec_source TEXT, sector TEXT,
                status TEXT, progress TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS ticket_meta (id TEXT PRIMARY KEY, url TEXT, state TEXT);
            CREATE TABLE IF NOT EXISTS fix_feedback (
                id INTEGER PRIMARY KEY AUTOINCREMENT, pr_id TEXT, req_id TEXT, feedback TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            """
        )


_init()


def save_extras(pr_id, head_sha, verdicts):
    """Called by verifier.verify(): keep reasoning / evidence locations for the dashboard."""
    with db.conn() as c:
        for v in verdicts:
            data = {k: v.get(k) for k in ("reasoning", "thinking", "downgraded_from", "evidence_locations", "claimed_evidence")}
            c.execute(
                "INSERT OR REPLACE INTO verdict_extras(pr_id, head_sha, req_id, data) VALUES (?, ?, ?, ?)",
                (pr_id, head_sha, v["req_id"], json.dumps(data)),
            )


# ---------------------------------------------------------------------------
# helpers


def _now():
    return datetime.now(timezone.utc).isoformat()


def _pr_id_for(number: int) -> str:
    with db.conn() as c:
        row = c.execute("SELECT pr_id FROM pr_meta WHERE number=? ORDER BY rowid DESC LIMIT 1", (number,)).fetchone()
        if not row:
            row = c.execute("SELECT pr_id FROM verdicts WHERE pr_id LIKE ? ORDER BY id DESC LIMIT 1", (f"%/{number}",)).fetchone()
    if not row:
        raise HTTPException(404, f"PR #{number} has not been checked yet. Paste its link first.")
    return row["pr_id"]


def _num(pr_id: str) -> int:
    return int(pr_id.rsplit("/", 1)[1])


def _fetch_meta(owner, repo, number):
    pr_id = f"{owner}/{repo}/{number}"
    try:
        r = requests.get(f"{github.API}/repos/{owner}/{repo}/pulls/{number}", headers=github.headers(), timeout=30)
        r.raise_for_status()
        j = r.json()
        title, url, branch = j.get("title", f"PR #{number}"), j.get("html_url", ""), j.get("head", {}).get("ref", "")
    except Exception:
        title, url, branch = f"PR #{number}", f"https://github.com/{owner}/{repo}/pull/{number}", ""
    with db.conn() as c:
        c.execute("INSERT OR REPLACE INTO pr_meta(pr_id, number, title, url, branch) VALUES (?, ?, ?, ?, ?)",
                  (pr_id, number, title, url, branch))
        # Auto-link the PR to a ticket whose key appears in the branch name or title (e.g. CARE-12-booking).
        keys = TICKET_KEY.findall(f"{branch} {title}")
        for k in keys:
            if c.execute("SELECT 1 FROM tickets WHERE id=?", (k,)).fetchone():
                c.execute("INSERT OR IGNORE INTO pr_tickets(pr_id, ticket_id) VALUES (?, ?)", (pr_id, k))
    return pr_id


def _ticket_url(key):
    if not key:
        return None
    with db.conn() as c:
        row = c.execute("SELECT url FROM ticket_meta WHERE id=?", (key,)).fetchone()
    if row and row["url"]:
        return row["url"]
    return f"{TICKET_URL.rstrip('/')}/{key}" if TICKET_URL else None


def _evidence(extras, verdict_row):
    locs = (extras or {}).get("evidence_locations") or []
    out = []
    for loc in locs:  # merge consecutive lines from the same file into one block
        if out and out[-1]["file"] == loc["file"] and out[-1]["end_line"] + 1 == loc["line"]:
            out[-1]["end_line"] = loc["line"]
            out[-1]["code"] += "\n" + loc["code"]
        else:
            out.append({"file": loc["file"], "start_line": loc["line"], "end_line": loc["line"], "code": loc["code"]})
    if not out:
        claimed = (extras or {}).get("claimed_evidence") or json.loads(verdict_row.get("evidence") or "[]")
        if claimed:
            out = [{"file": "(quoted by the AI)", "start_line": 1, "end_line": len(claimed), "code": "\n".join(claimed)}]
    return out


def _review(pr_id: str, sector: str | None):
    with db.conn() as c:
        latest = c.execute("SELECT head_sha FROM verdicts WHERE pr_id=? ORDER BY id DESC LIMIT 1", (pr_id,)).fetchone()
        if not latest:
            raise HTTPException(404, "No verification has run for this PR yet.")
        sha = latest["head_sha"]
        rows = [dict(r) for r in c.execute("SELECT * FROM verdicts WHERE pr_id=? AND head_sha=? ORDER BY req_id", (pr_id, sha))]
        texts = {r["req_id"]: r["text"] for r in c.execute("SELECT req_id, text FROM requirements")}
        extras = {r["req_id"]: json.loads(r["data"]) for r in c.execute(
            "SELECT req_id, data FROM verdict_extras WHERE pr_id=? AND head_sha=?", (pr_id, sha))}
        meta = c.execute("SELECT * FROM pr_meta WHERE pr_id=?", (pr_id,)).fetchone()
        tk = c.execute("SELECT ticket_id FROM pr_tickets WHERE pr_id=? LIMIT 1", (pr_id,)).fetchone()
        ovr = {}
        for o in c.execute("SELECT * FROM overrides WHERE pr_id=? ORDER BY id", (pr_id,)):
            ovr[o["req_id"]] = dict(o)
    n = _num(pr_id)
    verdicts = []
    for v in rows:
        ex = extras.get(v["req_id"], {})
        o = ovr.get(v["req_id"])
        ui_verdict = TO_UI.get(v["verdict"], "needs_human")
        override = None
        if o:
            override = {"id": str(o["id"]), "pr_id": n, "req_id": o["req_id"],
                        "original_verdict": TO_UI.get(o["original_verdict"], "needs_human"),
                        "new_verdict": TO_UI.get(o["new_verdict"], "needs_human"),
                        "reason": o["reason"], "author": "reviewer", "created_at": o["created_at"]}
            ui_verdict = override["new_verdict"]
        downgraded = TO_UI.get(ex.get("downgraded_from") or "", None)
        verdicts.append({
            "req_id": v["req_id"],
            "requirement": texts.get(v["req_id"], v["req_id"]),
            "verdict": ui_verdict,
            "confidence": v.get("confidence") or 0.0,
            "model": "super" if str(v.get("model_used", "")).lower() in ("super", "deep") else "lightning",
            "thinking": bool(ex.get("thinking")),
            "latency_ms": v.get("latency_ms") or 0,
            "reasoning": ex.get("reasoning") or "",
            "evidence": _evidence(ex, v),
            "evidence_verified": not (v["verdict"] == "human" and downgraded),
            "downgraded_from": downgraded,
            "suggested_diff": v.get("suggested_diff") or None,
            "suggested_test": v.get("suggested_test") or None,
            "override": override,
        })
    ticket = tk["ticket_id"] if tk else ""
    return {
        "pr_id": n,
        "title": meta["title"] if meta else f"PR #{n}",
        "url": meta["url"] if meta else f"https://github.com/{pr_id.rsplit('/', 1)[0]}/pull/{n}",
        "ticket_key": ticket,
        "ticket_url": _ticket_url(ticket) or (meta["url"] if meta else ""),
        "branch": meta["branch"] if meta else "",
        "head_sha": sha,
        "reviewed_at": _now(),
        "sector": sector or "general",
        "verdicts": verdicts,
    }


def _run(pr_id: str):
    import main  # late import: main imports this module

    owner, repo, n = pr_id.split("/")
    try:
        main.run_verification(owner, repo, int(n))
    except ValueError as e:
        raise HTTPException(400, str(e))
    except requests.HTTPError as e:
        raise HTTPException(502, f"GitHub API error: {e}")


# ---------------------------------------------------------------------------
# Endpoints


@router.get("/coverage")
def coverage(sector: str | None = None):
    with db.conn() as c:
        reqs = [dict(r) for r in c.execute("SELECT * FROM requirements ORDER BY req_id")]
        latest = {}
        for v in c.execute("SELECT * FROM verdicts ORDER BY id"):
            latest[v["req_id"]] = dict(v)
        extras = {}
        for e in c.execute("SELECT * FROM verdict_extras"):
            extras[(e["pr_id"], e["head_sha"], e["req_id"])] = json.loads(e["data"])
        overrides = {o["req_id"]: dict(o) for o in c.execute("SELECT * FROM overrides ORDER BY id")}
    out = []
    for r in reqs:
        v = latest.get(r["req_id"])
        key = r.get("ticket_id")
        verdict = v["verdict"] if v else None
        if v and r["req_id"] in overrides and overrides[r["req_id"]]["pr_id"] == v["pr_id"]:
            verdict = overrides[r["req_id"]]["new_verdict"]
        if not key:
            status, reason = "never_ticketed", "It is in the spec, but no ticket was ever created."
        elif not v:
            status, reason = "not_started", f"Ticket {key} exists, but no PR has been checked yet."
        else:
            status = {"covered": "met", "partial": "partial", "none": "missing", "human": "missing"}[verdict]
            ex = extras.get((v["pr_id"], v["head_sha"], r["req_id"]), {})
            reason = None if status == "met" else (
                "The AI isn't sure, so a person needs to check." if verdict == "human" else ex.get("reasoning") or None)
        out.append({
            "req_id": r["req_id"], "text": r["text"], "status": status,
            "priority": "high" if HIGH.search(r["text"]) else "medium",
            "ticket_key": key, "ticket_url": _ticket_url(key),
            "pr_id": _num(v["pr_id"]) if v else None,
            "pr_url": f"https://github.com/{v['pr_id'].rsplit('/', 1)[0]}/pull/{_num(v['pr_id'])}" if v else None,
            "drift": None, "reason": reason,
        })
    proj = _project()
    return {"project": proj["name"] if proj else PROJECT, "spec_name": proj["spec_source"] if proj else SPEC_NAME,
            "updated_at": _now(), "requirements": out}


@router.get("/prs")
def prs():
    with db.conn() as c:
        ids = [r["pr_id"] for r in c.execute("SELECT pr_id, MAX(id) m FROM verdicts GROUP BY pr_id ORDER BY m DESC")]
    out = []
    for pid in ids:
        rv = _review(pid, None)
        out.append({"pr_id": rv["pr_id"], "title": rv["title"], "ticket_key": rv["ticket_key"],
                    "met": sum(v["verdict"] == "met" for v in rv["verdicts"]), "total": len(rv["verdicts"]),
                    "updated_at": rv["reviewed_at"]})
    return out


@router.get("/prs/{number}/review")
def review(number: int, sector: str | None = None):
    return _review(_pr_id_for(number), sector)


@router.post("/prs/{number}/rerun")
def rerun(number: int, sector: str | None = None):
    pid = _pr_id_for(number)
    owner, repo, n = pid.split("/")
    _fetch_meta(owner, repo, int(n))
    _run(pid)
    return _review(pid, sector)


class LinkIn(BaseModel):
    url: str


@router.post("/prs/check")
def check(body: LinkIn):
    import main

    try:
        owner, repo, n = github.parse(body.url)
    except ValueError as e:
        raise HTTPException(400, str(e))
    pid = _fetch_meta(owner, repo, n)
    _run(pid)
    try:  # keep watching: every new push to this PR is re-checked automatically
        main.watch_pr(main.PR(pr_url=f"https://github.com/{owner}/{repo}/pull/{n}"))
    except Exception:
        pass
    return {"pr_id": n}


class OverrideIn(BaseModel):
    pr_id: int
    req_id: str
    new_verdict: str
    reason: str
    author: str = "reviewer"


@router.post("/overrides")
def add_override(o: OverrideIn):
    if len(o.reason.strip()) < 3:
        raise HTTPException(400, "Reason is required")
    pid = _pr_id_for(o.pr_id)
    with db.conn() as c:
        cur = c.execute("SELECT verdict FROM verdicts WHERE pr_id=? AND req_id=? ORDER BY id DESC LIMIT 1", (pid, o.req_id)).fetchone()
        original = cur["verdict"] if cur else "human"
        new = TO_BACKEND.get(o.new_verdict, "human")
        cursor = c.execute("INSERT INTO overrides(req_id, pr_id, original_verdict, new_verdict, reason) VALUES (?, ?, ?, ?, ?)",
                           (o.req_id, pid, original, new, f"{o.reason.strip()}"))
        oid = cursor.lastrowid
    return {"id": str(oid), "pr_id": o.pr_id, "req_id": o.req_id, "original_verdict": TO_UI.get(original, "needs_human"),
            "new_verdict": o.new_verdict, "reason": o.reason.strip(), "author": o.author, "created_at": _now()}


@router.get("/overrides")
def list_overrides():
    with db.conn() as c:
        rows = [dict(r) for r in c.execute("SELECT * FROM overrides ORDER BY id")]
    return [{"id": str(r["id"]), "pr_id": _num(r["pr_id"]) if "/" in r["pr_id"] else 0, "req_id": r["req_id"],
             "original_verdict": TO_UI.get(r["original_verdict"], "needs_human"), "new_verdict": TO_UI.get(r["new_verdict"], "needs_human"),
             "reason": r["reason"], "author": "reviewer", "created_at": r["created_at"]} for r in rows]


class FixIn(BaseModel):
    feedback: str


@router.post("/prs/{number}/fixes/{req_id}")
def redo_fix(number: int, req_id: str, body: FixIn):
    pid = _pr_id_for(number)
    owner, repo, n = pid.split("/")
    with db.conn() as c:
        req = c.execute("SELECT text FROM requirements WHERE req_id=?", (req_id,)).fetchone()
        prev = c.execute("SELECT suggested_diff FROM verdicts WHERE pr_id=? AND req_id=? ORDER BY id DESC LIMIT 1", (pid, req_id)).fetchone()
        c.execute("INSERT INTO fix_feedback(pr_id, req_id, feedback) VALUES (?, ?, ?)", (pid, req_id, body.feedback))
    try:
        diff = github.get_diff(owner, repo, int(n))[:60000]
    except Exception:
        diff = ""
    try:
        return engine.regenerate_fix(req_id, req["text"] if req else req_id, diff, prev["suggested_diff"] if prev else "", body.feedback)
    except Exception as e:
        raise HTTPException(502, f"Could not regenerate the fix: {e}")


@router.get("/eval")
def get_eval():
    p = ROOT / "eval" / "results" / "eval.json"
    if not p.exists():
        raise HTTPException(404, "No eval results yet. Run: python3 eval/run_eval.py --api http://localhost:8000/ui")
    return json.loads(p.read_text())


GENERAL_RULES = [
    {"id": "GEN-1", "text": "Every requirement must cite code evidence or be marked Check needed."},
    {"id": "GEN-2", "text": "New endpoints need at least one test."},
]


@router.get("/rulepacks/{sector}")
def rulepack(sector: str):
    try:
        import rulepacks

        rules = rulepacks.load_pack(sector)
    except Exception:
        rules = []
    if not rules:
        return {"sector": "general", "name": "General software", "rules": GENERAL_RULES}
    names = {"medical": "Medical / health data", "finance": "Finance / payments"}
    return {"sector": sector, "name": names.get(sector, sector.title()),
            "rules": [{"id": r["id"], "text": f"{r['title']}: {r['check']}"} for r in rules]}


class SharpenIn(BaseModel):
    ticket: str
    sector: str | None = None


@router.post("/sharpen")
def sharpen(body: SharpenIn):
    """Nimalan's Ticket Sharpener (+ redundancy check if REPO_PATH is set)."""
    try:
        from api import sharpen as sharpen_route, SharpenIn as SIn  # ticket_sharpener/api.py
    except Exception as e:
        raise HTTPException(500, f"Ticket Sharpener unavailable: {e}")
    return sharpen_route(SIn(ticket=body.ticket, sector=body.sector))


class DraftIn(BaseModel):
    req_id: str
    text: str
    sector: str | None = None


@router.post("/tickets/draft")
def draft(body: DraftIn):
    from sharpener import sharpen_ticket  # Nimalan

    res = sharpen_ticket(body.text, body.sector)
    crit = res.get("acceptance_criteria") or [l for l in (res.get("rewrite") or "").splitlines() if l.strip()] or [body.text]
    return {
        "req_id": body.req_id,
        "title": body.text.split(". ")[0].rstrip(".")[:90],
        "description": f"From the original spec ({body.req_id}): {body.text}",
        "acceptance_criteria": crit,
        "precision_score": res.get("score", 0),
        "issues": [i.get("why") or i.get("text") for i in res.get("issues", [])][:3] or ["Linked to the original requirement ID"],
    }


class TicketIn(BaseModel):
    req_id: str
    title: str
    description: str = ""
    acceptance_criteria: list[str] = []


@router.post("/tickets")
def create_ticket(t: TicketIn):
    with db.conn() as c:
        n = 1 + c.execute("SELECT COUNT(*) AS n FROM tickets").fetchone()["n"]
        key = f"{TICKET_PREFIX}-{n}"
        while c.execute("SELECT 1 FROM tickets WHERE id=?", (key,)).fetchone():
            n += 1
            key = f"{TICKET_PREFIX}-{n}"
        body = t.description + "\n\nAcceptance criteria:\n" + "\n".join(f"- {a}" for a in t.acceptance_criteria)
        c.execute("INSERT INTO tickets(id, title, body) VALUES (?, ?, ?)", (key, t.title, body))
        c.execute("UPDATE requirements SET ticket_id=? WHERE req_id=?", (key, t.req_id))
    return {"ticket_key": key, "ticket_url": _ticket_url(key) or ""}


class SpecIn(BaseModel):
    text: str
    sector: str | None = None


@router.post("/spec")
def import_spec(body: SpecIn):
    """Shreenidhi's splitter: spec text -> REQ-001..N stored as requirements (no tickets yet)."""
    data = engine.split_requirements(body.text)
    reqs = data.get("requirements", [])
    with db.conn() as c:
        for r in reqs:
            c.execute(
                """INSERT INTO requirements(req_id, text, ticket_id, sector) VALUES (?, ?, NULL, ?)
                   ON CONFLICT(req_id) DO UPDATE SET text=excluded.text, sector=excluded.sector""",
                (r["req_id"], r.get("requirement") or r.get("text", ""), body.sector),
            )
    return {"requirements": reqs}


class VerifyIn(BaseModel):
    requirements: list[dict]
    diff: str
    sector: str | None = "general"


@router.post("/verify")
def verify_direct(body: VerifyIn):
    """Used by eval/run_eval.py: requirements + diff in, dashboard-shaped verdicts out (no GitHub, no DB)."""
    out = []
    for r in body.requirements:
        rv = engine.timed_router(r["req_id"], r["text"], body.diff, high_stakes=bool(HIGH.search(r["text"])))
        out.append({"req_id": r["req_id"], "requirement": r["text"],
                    "verdict": TO_UI[{"FULFILLED": "covered", "PARTIAL": "partial", "NOT_VERIFIED": "none"}.get(rv["verdict"], "human")],
                    "confidence": rv["confidence"], "model": rv["model_used"], "thinking": rv["thinking"],
                    "latency_ms": rv["latency_ms"], "reasoning": rv.get("reasoning", ""), "evidence": [],
                    "evidence_verified": not rv.get("downgraded_from"), "suggested_diff": rv.get("suggested_diff"),
                    "suggested_test": rv.get("suggested_test")})
    return out


# ---------------------------------------------------------------------------
# Load a real project: GitHub repo + spec -> requirements, issues as tickets, PRs tracked

import threading  # noqa: E402

CLOSES = re.compile(r"\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+#(\d+)", re.I)
BRANCH_ISSUE = re.compile(r"(?:^|[/_-])(?:issue-?|gh-?)?(\d{1,6})(?:[/_-]|$)", re.I)


def _project():
    with db.conn() as c:
        row = c.execute("SELECT * FROM project WHERE id=1").fetchone()
    return dict(row) if row else None


def _set_progress(status, **progress):
    with db.conn() as c:
        c.execute("UPDATE project SET status=?, progress=? WHERE id=1", (status, json.dumps(progress)))


def _gh_json(path, params=None):
    r = requests.get(f"{github.API}{path}", headers=github.headers(), params=params or {}, timeout=30)
    r.raise_for_status()
    return r.json()


def _readme(owner, repo):
    try:
        r = requests.get(f"{github.API}/repos/{owner}/{repo}/readme", headers=github.headers("application/vnd.github.raw"), timeout=30)
        r.raise_for_status()
        return r.text
    except Exception:
        return ""


def _linked_issues(pr, issue_keys):
    text = f"{pr.get('title', '')}\n{pr.get('body') or ''}"
    nums = {f"#{n}" for n in CLOSES.findall(text)}
    nums |= {f"#{n}" for n in re.findall(r"\(#(\d+)\)", pr.get("title", ""))}
    m = BRANCH_ISSUE.search(pr.get("head", {}).get("ref", "") or "")
    if m:
        nums.add(f"#{m.group(1)}")
    return [k for k in nums if k in issue_keys]


def _check_prs_in_background(owner, repo, prs, issue_keys):
    import main

    checked, skipped = 0, []
    for i, pr in enumerate(prs):
        n = pr["number"]
        pid = f"{owner}/{repo}/{n}"
        _set_progress("checking", step="prs", done=i, total=len(prs), current=f"PR #{n}")
        links = _linked_issues(pr, issue_keys)
        with db.conn() as c:
            c.execute("INSERT OR REPLACE INTO pr_meta(pr_id, number, title, url, branch) VALUES (?, ?, ?, ?, ?)",
                      (pid, n, pr.get("title", f"PR #{n}"), pr.get("html_url", ""), pr.get("head", {}).get("ref", "")))
            for k in links:
                c.execute("INSERT OR IGNORE INTO pr_tickets(pr_id, ticket_id) VALUES (?, ?)", (pid, k))
            has_reqs = bool(links) and c.execute(
                f"SELECT 1 FROM requirements WHERE ticket_id IN ({','.join('?' * len(links))}) LIMIT 1", links).fetchone()
        if not has_reqs:
            skipped.append(n)
            continue
        try:
            main.run_verification(owner, repo, n)
            checked += 1
            if pr.get("state") == "open":
                try:
                    main.watch_pr(main.PR(pr_url=f"https://github.com/{owner}/{repo}/pull/{n}"))
                except Exception:
                    pass
        except Exception as e:
            skipped.append(n)
            print(f"[project] PR #{n} not checked: {e}")
    _set_progress("ready", step="done", done=len(prs), total=len(prs), checked=checked, skipped=skipped)


class ProjectIn(BaseModel):
    name: str | None = None
    repo_url: str
    spec: str = ""
    sector: str | None = "general"
    max_prs: int = 15


@router.post("/projects")
def load_project(body: ProjectIn):
    """Load a real project. Replaces the current one (one project at a time)."""
    m = re.match(r"^(?:https?://github\.com/)?([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git)?/?$", body.repo_url.strip())
    if not m:
        raise HTTPException(400, "Use a GitHub repo like https://github.com/owner/repo")
    owner, repo = m.groups()

    spec, source = body.spec.strip(), "pasted spec"
    if not spec:
        spec, source = _readme(owner, repo), "README.md"
        if not spec.strip():
            raise HTTPException(400, "No spec pasted and the repo has no README. Paste the spec or feature list.")

    # 1) start fresh
    with db.conn() as c:
        for t in ("verdicts", "overrides", "pr_tickets", "verdict_extras", "pr_meta", "fix_feedback", "ticket_meta"):
            c.execute(f"DELETE FROM {t}")
        c.execute("DELETE FROM requirements")
        c.execute("DELETE FROM tickets")
        c.execute("DELETE FROM project")
        c.execute("INSERT INTO project(id, name, repo, spec_source, sector, status, progress) VALUES (1, ?, ?, ?, ?, ?, ?)",
                  (body.name or repo, f"{owner}/{repo}", source, body.sector, "loading", json.dumps({"step": "spec"})))

    # 2) spec -> requirements (Shreenidhi's splitter)
    try:
        reqs = engine.split_requirements(spec[:20000]).get("requirements", [])
    except Exception as e:
        _set_progress("error", step="spec", error=str(e))
        raise HTTPException(502, f"Could not split the spec into requirements: {e}")
    reqs = [{"req_id": r.get("req_id") or f"REQ-{i+1:03d}", "text": r.get("requirement") or r.get("text") or ""} for i, r in enumerate(reqs)]
    reqs = [r for r in reqs if r["text"].strip()]

    # 3) GitHub issues -> tickets
    _set_progress("loading", step="issues", requirements=len(reqs))
    try:
        raw_issues = _gh_json(f"/repos/{owner}/{repo}/issues", {"state": "all", "per_page": 100})
        raw_prs = _gh_json(f"/repos/{owner}/{repo}/pulls", {"state": "all", "per_page": max(1, min(body.max_prs, 30)), "sort": "updated", "direction": "desc"})
    except requests.HTTPError as e:
        _set_progress("error", step="issues", error=str(e))
        raise HTTPException(502, f"GitHub API error (is the repo public and GITHUB_TOKEN set?): {e}")
    issues = [{"key": f"#{i['number']}", "title": i["title"], "body": i.get("body") or "", "url": i["html_url"], "state": i["state"]}
              for i in raw_issues if "pull_request" not in i]

    # 4) match requirements to issues (Nemotron Lightning)
    _set_progress("loading", step="matching", requirements=len(reqs), tickets=len(issues))
    matches = engine.match_requirements(reqs, issues)
    with db.conn() as c:
        for i in issues:
            c.execute("INSERT INTO tickets(id, title, body) VALUES (?, ?, ?)", (i["key"], i["title"], i["body"][:4000]))
            c.execute("INSERT OR REPLACE INTO ticket_meta(id, url, state) VALUES (?, ?, ?)", (i["key"], i["url"], i["state"]))
        for r in reqs:
            c.execute("INSERT INTO requirements(req_id, text, ticket_id, sector) VALUES (?, ?, ?, ?)",
                      (r["req_id"], r["text"], matches.get(r["req_id"]), body.sector))

    # 5) check the PRs in the background, then keep watching open ones
    issue_keys = {i["key"] for i in issues}
    _set_progress("checking", step="prs", done=0, total=len(raw_prs))
    threading.Thread(target=_check_prs_in_background, args=(owner, repo, raw_prs, issue_keys), daemon=True).start()

    linked = sum(1 for r in reqs if matches.get(r["req_id"]))
    return {"project": body.name or repo, "repo": f"{owner}/{repo}", "spec_source": source,
            "requirements": len(reqs), "tickets": len(issues), "linked_requirements": linked,
            "lost": len(reqs) - linked, "prs_to_check": len(raw_prs)}


@router.get("/projects/current")
def current_project():
    p = _project()
    if not p:
        raise HTTPException(404, "No project loaded yet.")
    p["progress"] = json.loads(p.get("progress") or "{}")
    return p
