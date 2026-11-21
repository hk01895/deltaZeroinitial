import json, threading, time
import os
import requests
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import db, github
from verifier import verify

app = FastAPI(
    title="deltazero API",
    version="1.0.0",
    description="Requirement traceability and GitHub PR verification"
)
db.init()
origins = os.getenv(
    "FRONTEND_ORIGINS",
    "http://localhost:3000,http://localhost:5173"
).split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)
EMOJI = {"covered": "🟢", "partial": "🟡", "none": "🔴", "human": "👤"}
VALID_VERDICTS = set(EMOJI)

class Ticket(BaseModel):
    id: str; 
    title: str; 
    body: str

class Req(BaseModel):
    req_id:str; 
    text:str; 
    ticket_id:str | None = None; 
    sector: str | None = None

class PR(BaseModel):
    pr_url: str

class PRLink(BaseModel):
    pr_url: str
    ticket_id: str

class Override(BaseModel):
    req_id: str 
    pr_id: str
    original_verdict: str
    new_verdict: str
    reason: str

@app.get("/")
def home():
    return {
        "project": "deltazero",
        "status": "running",
        "docs": "/docs"
    }

@app.get("/health")
def health():
    with db.conn() as c:
        c.execute("SELECT 1")

    return {"ok": True}

@app.post("/tickets")
def add_ticket(ticket: Ticket):
    with db.conn() as c:
        c.execute(
            """
            INSERT INTO tickets(id, title, body)
            VALUES (?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title=excluded.title,
                body=excluded.body
            """,
            (ticket.id, ticket.title, ticket.body)
        )

    return {"ok": True, "ticket_id": ticket.id}

@app.get("/tickets")
def list_tickets():
    with db.conn() as c:
        rows = c.execute(
            "SELECT * FROM tickets ORDER BY id"
        ).fetchall()

    return [dict(row) for row in rows]

@app.post("/requirements")
def add_requirement(req: Req):
    with db.conn() as c:
        if req.ticket_id:
            ticket = c.execute(
                "SELECT id FROM tickets WHERE id=?",
                (req.ticket_id,)
            ).fetchone()

            if not ticket:
                raise HTTPException(
                    404, "Ticket does not exist"
                )

        c.execute(
            """
            INSERT INTO requirements(
                req_id, text, ticket_id, sector
            )
            VALUES (?, ?, ?, ?)
            ON CONFLICT(req_id) DO UPDATE SET
                text=excluded.text,
                ticket_id=excluded.ticket_id,
                sector=excluded.sector
            """,
            (
                req.req_id,
                req.text,
                req.ticket_id,
                req.sector
            )
        )

    return {"ok": True, "req_id": req.req_id}


@app.post("/links/pr-ticket")
def link_pr_ticket(link: PRLink):
    try:
        owner, repo, number = github.parse(link.pr_url)
    except ValueError as e:
        raise HTTPException(400, str(e))

    pr_id = f"{owner}/{repo}/{number}"

    with db.conn() as c:
        ticket = c.execute(
            "SELECT id FROM tickets WHERE id=?",
            (link.ticket_id,)
        ).fetchone()

        if not ticket:
            raise HTTPException(404, "Ticket not found")

        c.execute(
            """
            INSERT OR IGNORE INTO pr_tickets(
                pr_id, ticket_id
            )
            VALUES (?, ?)
            """,
            (pr_id, link.ticket_id)
        )

    return {
        "ok": True,
        "pr_id": pr_id,
        "ticket_id": link.ticket_id
    }


def format_comment(sha, verdicts):
    covered = sum(
        v["verdict"] == "covered" for v in verdicts
    )

    lines = [
        f"{EMOJI[v['verdict']]} "
        f"{v['req_id']}: {v['verdict']}"
        for v in verdicts
    ]

    return (
        f"## deltazero Verification\n\n"
        f"**Requirements covered: "
        f"{covered}/{len(verdicts)}**\n\n"
        f"Commit: `{sha[:7]}`\n\n"
        + "\n".join(lines)
    )

def run_verification(owner, repo, number):
    pr_id = f"{owner}/{repo}/{number}"

    sha = github.get_head_sha(owner, repo, number)
    diff = github.get_diff(owner, repo, number)

    # GitHub may reject or truncate very large diffs.
    # Do not silently verify incomplete source code.
    if len(diff) > 60000:
        raise ValueError(
            "PR diff is too large for this demo verifier"
        )

    with db.conn() as c:
        # Prefer requirements associated with linked tickets.
        linked = c.execute(
            """
            SELECT r.req_id, r.text, r.sector
            FROM requirements r
            JOIN pr_tickets p
              ON p.ticket_id = r.ticket_id
            WHERE p.pr_id=?
            ORDER BY r.req_id
            """,
            (pr_id,)
        ).fetchall()

        # Demo fallback: verify all requirements if no links exist.
        if linked:
            reqs = [dict(r) for r in linked]
        else:
            reqs = [
                dict(r)
                for r in c.execute(
                    """
                    SELECT req_id, text, sector
                    FROM requirements
                    ORDER BY req_id
                    """
                ).fetchall()
            ]

    if not reqs:
        return pr_id, sha, {"verdicts": []}

    output = verify(pr_id, sha, diff, reqs)

    if not isinstance(output, dict):
        raise ValueError("Verifier must return a dictionary")

    verdicts = output.get("verdicts")

    if not isinstance(verdicts, list):
        raise ValueError("Verifier must return a verdicts list")

    expected = {r["req_id"] for r in reqs}
    actual = [v.get("req_id") for v in verdicts]

    if set(actual) != expected or len(actual) != len(expected):
        raise ValueError(
            "Verifier must return exactly one verdict "
            "per requirement"
        )

    for v in verdicts:
        if v.get("verdict") not in VALID_VERDICTS:
            raise ValueError("Invalid verifier verdict")

        evidence = v.get("evidence_lines", [])

        if not isinstance(evidence, list):
            raise ValueError("Evidence must be a list")

        # Evidence Guard: verify that claimed evidence
        # exists in the fetched diff. ("none" = not implemented,
        # so there is nothing to quote; don't downgrade it.)
        if v["verdict"] not in ("human", "none"):
            if not evidence or any(
                not isinstance(line, str)
                or not line.strip()
                or line not in diff
                for line in evidence
            ):
                v["verdict"] = "human"
                v["confidence"] = 0.0
                v["evidence_lines"] = []

    with db.conn() as c:
        # Replace any previous run for the same PR commit.
        c.execute(
            """
            DELETE FROM verdicts
            WHERE pr_id=? AND head_sha=?
            """,
            (pr_id, sha)
        )

        for v in verdicts:
            c.execute(
                """
                INSERT INTO verdicts(
                    pr_id, head_sha, req_id,
                    verdict, confidence, evidence,
                    suggested_diff, suggested_test,
                    model_used, latency_ms
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    pr_id,
                    sha,
                    v["req_id"],
                    v["verdict"],
                    v.get("confidence", 0),
                    json.dumps(v.get("evidence_lines", [])),
                    v.get("suggested_diff", ""),
                    v.get("suggested_test", ""),
                    v.get("model_used", "unknown"),
                    v.get("latency_ms", 0)
                )
            )

    return pr_id, sha, output

@app.post("/verify")
def verify_pr(pr: PR):
    try:
        owner, repo, number = github.parse(pr.pr_url)

        pr_id, sha, output = run_verification(
            owner, repo, number
        )

        comment_posted = False

        if (
            os.getenv(
                "POST_GITHUB_COMMENTS", "false"
            ).lower() == "true"
            and output["verdicts"]
        ):
            body = format_comment(
                sha, output["verdicts"]
            )

            github.post_comment(
                owner, repo, number, body
            )
            comment_posted = True

        return {
            "pr_id": pr_id,
            "head_sha": sha,
            "comment_posted": comment_posted,
            **output
        }

    except ValueError as e:
        raise HTTPException(400, str(e))

    except requests.HTTPError as e:
        raise HTTPException(
            502, f"GitHub API error: {e}"
        )

    except Exception as e:
        raise HTTPException(500, str(e))

@app.get("/results")
def results(pr_id: str):
    with db.conn() as c:
        latest = c.execute(
            """
            SELECT head_sha
            FROM verdicts
            WHERE pr_id=?
            ORDER BY id DESC
            LIMIT 1
            """,
            (pr_id,)
        ).fetchone()

        if not latest:
            return {"verdicts": []}

        rows = c.execute(
            """
            SELECT *
            FROM verdicts
            WHERE pr_id=? AND head_sha=?
            ORDER BY req_id
            """,
            (pr_id, latest["head_sha"])
        ).fetchall()

    verdicts = []

    for row in rows:
        v = dict(row)
        v["evidence_lines"] = json.loads(
            v.pop("evidence") or "[]"
        )
        verdicts.append(v)

    return {
        "pr_id": pr_id,
        "head_sha": latest["head_sha"],
        "verdicts": verdicts
    }


@app.get("/coverage")
def coverage():
    with db.conn() as c:
        rows = c.execute(
            """
            SELECT
                r.req_id,
                r.text,
                r.ticket_id,
                r.sector,
                (
                    SELECT v.verdict
                    FROM verdicts v
                    WHERE v.req_id=r.req_id
                    ORDER BY v.id DESC
                    LIMIT 1
                ) AS status
            FROM requirements r
            ORDER BY r.req_id
            """
        ).fetchall()

    result = []

    for row in rows:
        item = dict(row)

        item["never_ticketed"] = (
            item["ticket_id"] is None
        )

        if item["status"] is None:
            item["status"] = "unverified"

        result.append(item)

    return result

@app.post("/overrides")
def add_override(override: Override):
    if (
        override.original_verdict not in VALID_VERDICTS
        or override.new_verdict not in VALID_VERDICTS
    ):
        raise HTTPException(400, "Invalid verdict")

    if not override.reason.strip():
        raise HTTPException(400, "Reason is required")

    with db.conn() as c:
        c.execute(
            """
            INSERT INTO overrides(
                req_id, pr_id,
                original_verdict, new_verdict, reason
            )
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                override.req_id,
                override.pr_id,
                override.original_verdict,
                override.new_verdict,
                override.reason.strip()
            )
        )

        rows = c.execute(
            """
            SELECT *
            FROM overrides
            WHERE req_id=?
            ORDER BY id DESC
            LIMIT 5
            """,
            (override.req_id,)
        ).fetchall()

    return {
        "ok": True,
        "similar": [dict(r) for r in rows]
    }

@app.get("/overrides")
def get_overrides(req_id: str | None = None):
    with db.conn() as c:
        if req_id:
            rows = c.execute(
                """
                SELECT * FROM overrides
                WHERE req_id=?
                ORDER BY id DESC
                """,
                (req_id,)
            ).fetchall()
        else:
            rows = c.execute(
                """
                SELECT * FROM overrides
                ORDER BY id DESC
                """
            ).fetchall()

    return [dict(r) for r in rows]

WATCH = {}
WATCH_LOCK = threading.Lock()


def poll(owner, repo, number, stop_event):
    key = (owner, repo, number)
    last_verified_sha = None

    while not stop_event.is_set():
        try:
            sha = github.get_head_sha(
                owner, repo, number
            )

            if sha != last_verified_sha:
                run_verification(
                    owner, repo, number
                )
                last_verified_sha = sha

                print(
                    f"Verified {owner}/{repo}/{number}: "
                    f"{sha[:7]}"
                )

        except Exception as e:
            print("Polling error:", e)

        stop_event.wait(15)

    with WATCH_LOCK:
        if WATCH.get(key) is stop_event:
            del WATCH[key]

@app.post("/watch")
def watch_pr(pr: PR):
    try:
        owner, repo, number = github.parse(pr.pr_url)
    except ValueError as e:
        raise HTTPException(400, str(e))

    key = (owner, repo, number)

    with WATCH_LOCK:
        if key in WATCH:
            return {
                "watching": f"{owner}/{repo}/{number}",
                "already_watching": True
            }

        stop_event = threading.Event()
        WATCH[key] = stop_event

    thread = threading.Thread(
        target=poll,
        args=(owner, repo, number, stop_event),
        daemon=True
    )
    thread.start()

    return {
        "watching": f"{owner}/{repo}/{number}",
        "interval_seconds": 15
    }

@app.post("/unwatch")
def unwatch_pr(pr: PR):
    try:
        owner, repo, number = github.parse(pr.pr_url)
    except ValueError as e:
        raise HTTPException(400, str(e))

    key = (owner, repo, number)

    with WATCH_LOCK:
        stop_event = WATCH.get(key)

    if stop_event is None:
        return {"ok": True, "was_watching": False}

    stop_event.set()

    return {"ok": True, "was_watching": True}



# ---------------------------------------------------------------------------
# Integration: Ticket Sharpener (Nimalan) + dashboard adapter (/ui/*)
import sys as _sys
from pathlib import Path as _Path

_ROOT = _Path(__file__).resolve().parent.parent
for _p in (_ROOT / "ticket_sharpener", _ROOT / "ai_engine"):
    if str(_p) not in _sys.path:
        _sys.path.insert(0, str(_p))

try:
    from api import router as sharpener_router  # ticket_sharpener/api.py: POST /api/sharpen, /api/reindex, GET /api/rulepacks
    app.include_router(sharpener_router)
except Exception as _e:
    print("[main] Ticket Sharpener not mounted:", _e)

import ui_api  # noqa: E402

app.include_router(ui_api.router)


@app.get("/requirements")
def list_requirements():
    with db.conn() as c:
        rows = c.execute("SELECT * FROM requirements ORDER BY req_id").fetchall()
    return [dict(r) for r in rows]

'''
@app.get("/requirements")
def list_requirements():
    with db.conn() as c:
        rows = c.execute(
            "SELECT * FROM requirements ORDER BY req_id"
        ).fetchall()

    return [dict(row) for row in rows]

def run_verification(owner, repo, n):
    pr_id = f"{owner}/{repo}/{n}"
    sha = github.get_head_sha(owner, repo, n)
    diff = github.get_diff(owner, repo, n)[:60000]
    c = db.conn()
    reqs = [dict(r) for r in c.execute("SELECT req_id, text FROM requirements")]
    out = verify(pr_id, sha, diff, reqs)
    for v in out["verdicts"]:
        c.execute("""INSERT INTO verdicts(pr_id, head_sha, req_id, verdict, confidence, 
            evidence, suggested_diff, suggested_test, model_used, latency_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (pr_id, sha, v["req_id"], v["verdict"], v["confidence"], 
         json.dumps(v["evidence_lines"]), v["suggested_diff"], 
         v["suggested_test"], v["model_used"], v["latency_ms"]))
    c.commit()
    return pr_id, sha, out

@app.post("/verify")
def verify_pr(p: PR):
    owner, repo, n = github.parse(p.pr_url)
    pr_id, sha, out = run_verification(owner, repo, n)
    covered = sum(v["verdict"] == "covered" for v in out["verdicts"])
    lines = [f"{EMOJI[v['verdict']]} {v['req_id']}" for v in out["verdicts"]]
    github.post_comment(owner, repo, n, 
                        f"**Requirements: {covered}/{len(out['verdicts'])} covered** (commit {sha[:7]})\n\n"
                        + "\n".join(lines))
    return {"pr_id": pr_id, "head_sha": sha, **out}

@app.get("/results")
def results(pr_id: str):
    c = db.conn()
    sha = c.execute("SELECT head_sha FROM verdicts WHERE pr_id=? ORDER BY id DESC LIMIT 1", 
                    (pr_id,)).fetchone()
    if not sha: 
        return {"verdicts": []}
    rows = c.execute("SELECT * FROM verdicts WHERE pr_id=? AND head_sha=?",
                     (pr_id, sha["head_sha"])).fetchall()
    return {"head_sha": sha["head_sha"], "verdicts": [dict(r) for r in rows]}

@app.get("/coverage")
def coverage():
    c = db.conn()
    rows = c.execute("""SELECT r.req_id, r.text, r.ticket_id, 
    (SELECT verdict FROM verdicts v WHERE v.req_id = r.req_id ORDER BY id DESC LIMIT 1) AS status
    FROM requirements r""").fetchall()
    return [{**dict(r), "never_ticketed": not r["ticket_id"]} for r in rows]

@app.post("/overrides")
def add_override(o: Override):
    c = db.conn()
    c.execute("""INSERT INTO overrides(req_id, pr_id, original_verdict, new_verdict, reason)
                VALUES (?, ?, ?, ?, ?)""",
                (o.req_id, o.pr_id, o.original_verdict, o.new_verdict, o.reason))
    c.commit()
    similar = c.execute("SELECT * FROM overrides WHERE req_id=? ORDER BY id DESC LIMIT 5", 
                        (o.req_id,)).fetchall()
    return {"similar": [dict(s) for s in similar]}

WATCH = {}
def poll(owner, repo, n):
    while True:
        try:
            sha = github.get_head_sha(owner, repo, n)
            if WATCH.get((owner, repo, n)) != sha:
                WATCH[(owner, repo, n)] = sha
                run_verification(owner, repo, n)
        except Exception as e:
            print("poll error: ", e)
        time.sleep(10)

@app.post("/watch")
def watch(p: PR):
    owner, repo, n = github.parse(p.pr_url)
    threading.Thread(target = poll, args = (owner, repo, n), daemon = True).start()
    return {"watching": f"{owner}/{repo}/{n}"}   
'''