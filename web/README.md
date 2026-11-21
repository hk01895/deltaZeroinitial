# DeltaZero – web dashboard (Haasika)

Next.js 14 + Tailwind. Runs on mock data until the backend is up.

## Run it
```bash
cd web
npm install
cp .env.local.example .env.local   # leave NEXT_PUBLIC_API_URL empty for mock data
npm run dev                        # http://localhost:3000
```

## Pages
| Route | What it shows |
|---|---|
| `/coverage` | Coverage Map: every requirement by status, "never ticketed" highlighted, drift alerts, "Draft ticket" button |
| `/pr` | List of PRs with requirements-met score |
| `/pr/12` | PR results: verdict cards, code evidence, Evidence Guard, suggested diff + test, Override, Re-run |
| `/eval` | Precision, recall, false-positive rate, confusion matrix, fast vs. deep latency |
| `/sharpener` | Placeholder for Nimalan's Ticket Sharpener |

The **Rule pack** dropdown in the header (General / Medical / Finance) is sent as `?sector=` to the API and swaps the rule panel on PR pages.

## Demo flow (mock mode)
1. `/coverage` → "4/10 delivered… 2 requirements never became a ticket."
2. `/pr/12` → **2/5**. Show REQ-005 (Evidence Guard downgrade) and the suggested diff + test on REQ-004.
3. Override a verdict with a reason → card shows "Overridden by …".
4. Click **Re-run check** → **5/5**. (Refresh the page to reset the demo.)
5. `/eval` → numbers + latency chart.

## Connecting the backend
Set `NEXT_PUBLIC_API_URL=http://localhost:8000/ui` in `.env.local` (the backend's dashboard adapter, `backend/ui_api.py`). Endpoints and JSON shapes are in
`../docs/api-contract.md` and `lib/types.ts`. If any request fails, the UI falls back to mock data
and logs a warning, so the demo never shows a blank screen.
Backend needs CORS enabled for `http://localhost:3000`.
