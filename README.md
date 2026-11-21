# Δ0 DeltaZero
**No difference between what you promised and what you shipped.**

DeltaZero is an AI-powered requirements tracker for software teams. It traces every requirement from the original spec to the ticket, the pull request and the code, shows how many promises are still unkept (the **Δ**), and helps the team drive it to zero.

Powered by **NVIDIA Nemotron**: Lightning for fast checks, Super for the hard ones.

Built for the **Best Use of NVIDIA Nemotron** hackathon track.

## 💡 The problem
Teams set dozens of requirements at the start of a project, and some quietly never get built. A requirement that never became a ticket, a PR that only does half the job, a "12 hours" that was supposed to be "24 hours": nobody notices until QA, a customer or an auditor does.

Today's AI code reviewers check a pull request against its ticket. None of them check the **original promise**, so a requirement that was never ticketed is invisible to them.

## 🌟 Features
- **The Δ meter:** one number, how many promises aren't kept yet. It counts down live and celebrates at Δ 0.
- **Lost requirements:** finds requirements that are in the spec but never became a ticket. One click drafts a precise ticket for them.
- **Ticket Sharpener:** scores how precise a ticket is (0–100), flags vague words, checks if the code already does it, and rewrites it. It never invents numbers.
- **PR Verifier:** every requirement on the linked ticket gets **Met, Not met or Check needed**, with a confidence score, the exact code as proof, a suggested fix and a test.
- **Evidence Guard:** the AI has to quote lines that really exist in the code. If it can't, a person checks instead.
- **Fast/deep thinking:** Nemotron 3.5 Lightning (thinking off) checks first. Only unsure or high-stakes cases go to Nemotron 3.5 Super (thinking on).
- **Human override + learning:** override any verdict with a reason. Recent overrides become examples in the next prompt.
- **"Not the fix you want?":** tell the AI what you want instead and it rewrites the fix.
- **Suggested tickets:** follow-up tickets for whatever a pull request didn't finish, one click each.
- **Ask Δ:** chat with DeltaZero. "What's left?", "Are we ready to ship?", "Change X". It pushes back on risky changes, and you can still override with a reason.
- **Auto-check on every push:** paste a PR link once and DeltaZero re-checks it each time new code is pushed.
- **Eval on real projects:** 30 labeled cases built from real GitHub issues and pull requests, with precision, recall and false-positive rate.
- **Accessibility first:** three status colors only, every status spelled out in words, high contrast, keyboard focus, screen-reader labels, and works on phones.
- **Load any project:** point DeltaZero at a GitHub repo and its spec (or README). GitHub Issues become the tickets, and every PR that closes one is checked and watched.

## 🛠️ Tech stack
| Part | Technology | Purpose |
|---|---|---|
| AI | NVIDIA Nemotron 3.5 Lightning + 3.5 Super | Checking code against requirements, splitting specs, rewriting fixes and tickets |
| Embeddings | NVIDIA Nemotron embeddings | "Does the code already do this?" redundancy check |
| Backend | Python + FastAPI | API, verification runs, overrides, PR watching |
| Database | SQLite | Requirements, tickets, verdicts, overrides |
| Code access | GitHub REST API | Read pull requests and diffs, optional PR comments |
| Frontend | Next.js + TypeScript | Dashboard |
| Styling | Tailwind CSS | Dark navy theme, accessible layouts |
| Version control | Git + GitHub | Share code with the team |

## ⚙️ How it works
1. **Load a project:** a GitHub repo + its spec (or README). Nemotron Super splits the spec into requirements: REQ-001, REQ-002, …
2. **Tickets:** the repo's GitHub Issues become tickets, and Nemotron Lightning matches each requirement to one. Requirements with no ticket show up as **Lost**. New tickets go through the Ticket Sharpener.
3. **Pull request:** a PR that closes an issue (`Fixes #12`), or has the ticket key in its branch name (like `CARE-12-booking`), is linked to that ticket automatically.
4. **Check:** for every requirement on that ticket, Nemotron Lightning reads the diff and decides Met / Not met / Check needed. If it isn't sure, or the requirement is high-stakes, Nemotron Super thinks it through.
5. **Evidence Guard:** the quoted code is checked against the real diff. No proof means a person checks.
6. **Humans stay in charge:** overrides and "rewrite this fix" feedback are saved and fed into future checks.
7. **Every push is re-checked**, and the Δ on the dashboard updates.

GitHub access is **read-only for code**. DeltaZero reads pull requests and can post a comment. It never changes or merges code.

## 🚀 Getting started
**You need:** Python 3.11+, Node 18+, a free NVIDIA API key from [build.nvidia.com](https://build.nvidia.com), and a GitHub token.

**1. Backend**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # add NVIDIA_API_KEY and GITHUB_TOKEN
uvicorn main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

**2. Dashboard** (new terminal)
```bash
cd web
npm install
npm run dev
```
Then open http://localhost:3000.

**3. Load a real project:** click **+ Load project**, paste a GitHub repo URL and the spec (or leave the spec empty to use the repo's README). DeltaZero:
- splits the spec into requirements (Nemotron Super)
- reads the repo's **GitHub Issues as tickets** and matches each requirement to one (Nemotron Lightning). Requirements with no issue show as **Lost**.
- checks every PR that closes one of those issues (`Fixes #12`, `Closes #12`, or a branch like `12-search`), then keeps watching open PRs for new pushes

**Or check one pull request:** paste its link into "Check a pull request" on the home page.


**Run the eval on real GitHub projects:**
```bash
export GITHUB_TOKEN=$(gh auth token)
python3 eval/build_cases.py --n 10
python3 eval/run_eval.py
```
Details: [`eval/README.md`](eval/README.md). Every endpoint and JSON shape: [`docs/api-contract.md`](docs/api-contract.md).

## 📁 Project layout
| Folder | What's inside |
|---|---|
| `ai_engine/` | Nemotron calls, review prompt, Lightning → Super router, Evidence Guard, spec splitter, learning from corrections |
| `backend/` | FastAPI + SQLite, GitHub integration, PR watching, dashboard API (`/ui/*`) |
| `ticket_sharpener/` | Ticket Sharpener, redundancy check, medical and finance rule packs |
| `web/` | Next.js dashboard |
| `eval/` | Build test cases from real GitHub projects and score the verifier |
| `docs/` | API contract |

## 🌿 Branches
- **main:** stable, demo-ready code
- **integration:** AI engine + backend + Ticket Sharpener + dashboard combined (merge this into main)
- **backend:** original FastAPI backend and GitHub integration
- **backend-nemotron:** original Nemotron AI engine notebook (now `ai_engine/` on integration)
- **person-d-sharpener:** original Ticket Sharpener work

## 🗺️ What's next
- A GitHub App so every repo is checked automatically, no link needed
- Two-way Jira sync for tickets and acceptance criteria
- Fine-tuning Nemotron on each team's override history
- Self-hosted deployment for hospitals, banks and other regulated teams
- Traceability reports auditors can sign off on

## 👥 Team
Shreenidhi · Shreya · Haasika · Nimalan

Made with 💙 for the NVIDIA Nemotron hackathon track
