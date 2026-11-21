# Δ0 DeltaZero

**No difference between what you promised and what you shipped.**

Teams set dozens of requirements at the start of a project, and some quietly never get built. Nobody notices until QA, a customer, or an auditor does.
DeltaZero traces every original requirement from **spec → ticket → pull request → code** and shows the gap (the Δ). Its AI, powered by **NVIDIA Nemotron**, checks each PR against each requirement and pushes the Δ toward zero.

---

## What it does

| | Feature | What it means |
|---|---|---|
| Δ | **Delta meter** | One number: promises not kept yet. Counts down live; celebrates at Δ 0. |
| ✕ | **Lost requirements** | Requirements in the spec that never became a ticket. PR-level tools can't see these. One click drafts a precise ticket. |
| ✎ | **Ticket Sharpener** | Scores a ticket's precision (0–100), flags vague words, checks if the code already does it, rewrites it. Never invents numbers. |
| ⇄ | **PR Verifier** | Every requirement on the linked ticket gets **Met / Not met / Check needed**, with a confidence score, the exact code as evidence, a suggested fix and a test. |
| 🛡 | **Evidence Guard** | The AI must quote lines that really exist in the diff. If it can't, the verdict becomes *Check needed*. |
| ⚡ | **Fast/deep router** | Nemotron 3.5 **Lightning** (thinking off) checks first; unsure or high-stakes cases escalate to Nemotron 3.5 **Super** (thinking on). |
| ↯ | **Human override + learning** | Override any verdict with a reason; recent overrides are fed back into the prompt as examples. |
| ↻ | **"Not the fix you want?"** | Tell the AI what you want instead and it rewrites the fix. |
| 🏥 | **Rule packs** | Medical and finance rules (audit logging, encryption, idempotency…) added to every check. |
| Δ | **Ask Δ** | Chat: "what's left?", "are we ready to ship?", "change X". Pushes back on risky changes; you can override with a reason. |
| ◎ | **Eval** | 30 labeled cases built from real GitHub issue + PR pairs; precision, recall, false-positive rate. |
| ▶ | **Live demo** | A guided 19-step tour of every feature, in plain English. |

## How it works

```
1. Spec ──► requirements (REQ-001…N)            ai_engine: Nemotron Super splits the spec
2. Ticket ──► Ticket Sharpener                   ticket_sharpener: score, rewrite, redundancy check
3. Dev opens a PR (branch like CARE-12-booking)
4. DeltaZero links the PR to its ticket, fetches the diff from GitHub,
   checks every requirement:  Lightning ─(unsure?)─► Super  ─► Evidence Guard
5. Results: dashboard + (optional) PR comment; every new push is re-checked automatically
6. Reviewer overrides / asks for a different fix ─► the AI learns from it
7. Dashboard: Δ, lost requirements, requirement map, eval
```

GitHub access is **read-only for code**. DeltaZero reads PRs and diffs, and can post a comment. It never changes or merges code.

## Repo layout

| Folder | Owner | What |
|---|---|---|
| `ai_engine/` | Shreenidhi (A) | `engine.py`: Nemotron calls, review prompt, Lightning→Super router, Evidence Guard, spec splitter, learning from corrections, fix regeneration. `deltazero_colab.py` is the original notebook. |
| `backend/` | Shreya (B) | FastAPI + SQLite. GitHub PR fetch, verification runs, overrides, coverage, PR watching. `ui_api.py` adapts it for the dashboard (`/ui/*`). `seed_demo.py` loads the demo project. |
| `web/` | Haasika (C) | Next.js + Tailwind dashboard: Δ meter, requirement map, PR review, override, eval, Ask Δ, live demo tour. |
| `ticket_sharpener/` | Nimalan (D) | Ticket Sharpener, redundancy check (Nemotron embeddings), medical/finance rule packs. |
| `eval/` | Team | Build 30 cases from real GitHub projects and score the verifier. |
| `docs/` | Team | `api-contract.md`: every endpoint and JSON shape. |

## Run it

**Prerequisites:** Python 3.11+, Node 18+, an NVIDIA API key from [build.nvidia.com](https://build.nvidia.com) (free), a GitHub token.

```bash
# 1) Backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # add NVIDIA_API_KEY and GITHUB_TOKEN
python3 seed_demo.py --reset  # loads the CareSlot demo project (10 requirements, 2 of them lost)
uvicorn main:app --reload --port 8000
#    API docs: http://localhost:8000/docs

# 2) Dashboard (new terminal)
cd web
npm install
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000/ui
npm run dev                         # http://localhost:3000
```

Then paste a GitHub PR link into **"Check a pull request"**. Put the ticket key in the branch name (e.g. `CARE-12-booking`) and it's linked automatically. DeltaZero keeps watching that PR and re-checks every push.

**No API key / no internet?**
- Backend: set `DELTAZERO_FAKE_LLM=1` in `backend/.env` for deterministic offline answers.
- Dashboard: leave `NEXT_PUBLIC_API_URL` empty to run fully on built-in demo data. Good as a demo backup.

**Your own spec instead of the demo:**
```bash
curl -X POST localhost:8000/ui/spec -H 'content-type: application/json' \
     -d '{"text": "- Users can reset passwords by email\n- Admins can export reports as CSV", "sector": "general"}'
```

## Eval on real projects

```bash
export GITHUB_TOKEN=$(gh auth token)
python3 eval/build_cases.py --n 10                     # 10 real merged PRs that close an issue → 30 cases
python3 eval/run_eval.py --api http://localhost:8000/ui # → eval/results/eval.json (shown on the Eval page)
```
See [`eval/README.md`](eval/README.md) for how the labels are built.

## Main endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/ui/prs/check` | Paste a PR link: verify it, link its ticket, start watching for pushes |
| GET | `/ui/coverage` | Every requirement with status: met / partial / missing / not started / never ticketed |
| GET | `/ui/prs/{n}/review` · POST `/ui/prs/{n}/rerun` | Verdicts for a PR, or re-check its latest commit |
| POST | `/ui/overrides` | Override a verdict (reason required) |
| POST | `/ui/prs/{n}/fixes/{req}` | Rewrite a suggested fix from reviewer feedback |
| POST | `/ui/tickets/draft` · `/ui/tickets` | Draft and create a ticket for a lost requirement |
| POST | `/ui/sharpen` | Ticket Sharpener |
| POST | `/ui/spec` | Split a spec into requirements |
| POST | `/ui/verify` | Requirements + diff → verdicts (used by the eval) |
| POST | `/verify`, `/watch` · GET `/results`, `/coverage` | Shreya's original backend endpoints (unchanged) |

Full shapes: [`docs/api-contract.md`](docs/api-contract.md).

## Built with
NVIDIA Nemotron 3.5 Lightning · Nemotron 3.5 Super · Nemotron embeddings · FastAPI · SQLite · GitHub REST API · Next.js · Tailwind CSS

## Team
Shreenidhi (AI engine) · Shreya (backend + GitHub) · Haasika (dashboard) · Nimalan (Ticket Sharpener + rule packs)
