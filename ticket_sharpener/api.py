"""
FastAPI router for Person B to mount:   import sys; sys.path.append("ticket_sharpener"); from api import router; app.include_router(router)
Endpoints:
  POST /api/sharpen      {ticket, sector?}  -> score, issues, rewrite, acceptance_criteria, redundancy
  GET  /api/rulepacks    -> {"sectors": [...]}
Set REPO_PATH to the demo repo so the redundancy check has something to search.
"""
import os

from fastapi import APIRouter
from pydantic import BaseModel

import redundancy
import rulepacks
from sharpener import sharpen_ticket

router = APIRouter()
_index = None


def get_index():
    global _index
    path = os.getenv("REPO_PATH")
    if _index is None and path:
        _index = redundancy.index_repo(path)
    return _index


class SharpenIn(BaseModel):
    ticket: str
    sector: str | None = None


@router.post("/api/sharpen")
def sharpen(body: SharpenIn):
    idx = get_index()
    red = redundancy.check_redundancy(idx, body.ticket) if idx else {"status": "unknown", "matches": [],
                                                                    "explanation": "No repo indexed (set REPO_PATH)."}
    return sharpen_ticket(body.ticket, body.sector, redundancy=red)


@router.post("/api/reindex")
def reindex():
    """Call after new commits land in the demo repo so the redundancy check sees them."""
    global _index
    _index = None
    path = os.getenv("REPO_PATH")
    if path:
        _index = redundancy.index_repo(path, cache=False)
    return {"chunks": len(_index["chunks"]) if _index else 0}


@router.get("/api/rulepacks")
def packs():
    return {"sectors": rulepacks.available_sectors()}
