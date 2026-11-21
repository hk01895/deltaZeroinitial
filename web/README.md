# DeltaZero dashboard

Next.js 14 + Tailwind. Shows only real data from the DeltaZero backend. There is no built-in sample project.

## Run it
```bash
cd web
npm install
npm run dev        # http://localhost:3000
```
The backend must be running at `http://localhost:8000` (see the main README). To use a different address, create `web/.env.local` with `NEXT_PUBLIC_API_URL=http://<host>:8000/ui`.

## Pages
| Route | What it shows |
|---|---|
| `/` | The Δ, lost requirements, pull requests, requirement map. Empty until you load a project. |
| `/project/new` | Load a project: GitHub repo + spec (or README) |
| `/pr`, `/pr/<number>` | PR results: verdicts, code evidence, suggested fix + test, override, re-run |
| `/sharpener` | Ticket Sharpener |
| `/eval` | Accuracy on real GitHub projects (after running `eval/run_eval.py`) |

Endpoints and JSON shapes: `../docs/api-contract.md` and `lib/types.ts`.
