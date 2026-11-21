# deltaZeroinitial
tidalbyte project

## ticket_sharpener/ (Person D)
Ticket Sharpener, redundancy check, sector rule packs. See `ticket_sharpener/demo_tickets.md`.
- Test without an API key: `cd ticket_sharpener && python3 test_offline.py`
- Env: `NVIDIA_API_KEY`, `NEMOTRON_FAST_MODEL`, `NEMOTRON_DEEP_MODEL`, `NEMOTRON_EMBED_MODEL`, `REPO_PATH`
- Backend: `sys.path.append("ticket_sharpener"); from api import router; app.include_router(router)`
- Page: `ticket_sharpener/web/sharpener.html`
