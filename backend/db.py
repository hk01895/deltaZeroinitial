
import os
import sqlite3

DB_PATH = os.getenv("DATABASE_PATH", "app.db")


def conn():
    c = sqlite3.connect(
        DB_PATH,
        timeout=30,
        check_same_thread=False
    )
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    return c


def init():
    with conn() as c:
        c.executescript("""
        CREATE TABLE IF NOT EXISTS tickets (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            body TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS requirements (
            req_id TEXT PRIMARY KEY,
            text TEXT NOT NULL,
            ticket_id TEXT,
            sector TEXT,
            FOREIGN KEY (ticket_id)
                REFERENCES tickets(id)
        );

        CREATE TABLE IF NOT EXISTS pr_tickets (
            pr_id TEXT NOT NULL,
            ticket_id TEXT NOT NULL,
            PRIMARY KEY (pr_id, ticket_id),
            FOREIGN KEY (ticket_id)
                REFERENCES tickets(id)
        );

        CREATE TABLE IF NOT EXISTS verdicts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pr_id TEXT NOT NULL,
            head_sha TEXT NOT NULL,
            req_id TEXT NOT NULL,
            verdict TEXT NOT NULL,
            confidence REAL,
            evidence TEXT,
            suggested_diff TEXT,
            suggested_test TEXT,
            model_used TEXT,
            latency_ms INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS overrides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            req_id TEXT NOT NULL,
            pr_id TEXT NOT NULL,
            original_verdict TEXT NOT NULL,
            new_verdict TEXT NOT NULL,
            reason TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_verdicts_pr
        ON verdicts(pr_id, head_sha);

        CREATE INDEX IF NOT EXISTS idx_verdicts_req
        ON verdicts(req_id);
        """)
