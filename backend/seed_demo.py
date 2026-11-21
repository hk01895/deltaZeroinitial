"""
Load the CareSlot demo project into the database: 10 requirements, 4 tickets.
REQ-009 and REQ-010 deliberately have NO ticket (they show up as "Lost").

    cd backend && python3 seed_demo.py           # add / update
    cd backend && python3 seed_demo.py --reset   # wipe verdicts, overrides and tickets first

Or load any spec with Shreenidhi's splitter instead:
    curl -X POST localhost:8000/ui/spec -H 'content-type: application/json' -d '{"text": "...your spec..."}'
"""
import sys

import db

TICKETS = [
    ("CARE-12", "Appointment booking endpoint", "Booking, double-booking guard, confirmation email, cancellation, audit log."),
    ("CARE-9", "Doctor weekly schedule", "Doctors see their next 7 days."),
    ("CARE-7", "Session timeout", "Expire sessions after inactivity."),
    ("CARE-15", "Encrypt patient phone numbers", "Store phone numbers encrypted at rest."),
]

REQUIREMENTS = [
    ("REQ-001", "Patients can book an appointment by choosing a doctor and an open time slot.", "CARE-12"),
    ("REQ-002", "Booking the same slot twice returns HTTP 409 and does not create a second appointment.", "CARE-12"),
    ("REQ-003", "Patients receive a confirmation email within 60 seconds of booking.", "CARE-12"),
    ("REQ-004", "Appointments can be cancelled up to 24 hours before the start time.", "CARE-12"),
    ("REQ-005", "Every read of patient records is written to an audit log with user ID and timestamp.", "CARE-12"),
    ("REQ-006", "Doctors can view their schedule for the next 7 days.", "CARE-9"),
    ("REQ-007", "Sessions expire after 15 minutes of inactivity.", "CARE-7"),
    ("REQ-008", "Patient phone numbers are stored encrypted at rest.", "CARE-15"),
    ("REQ-009", "Patients get an SMS reminder 24 hours before their appointment.", None),
    ("REQ-010", "Patients can export their full appointment history as a PDF.", None),
]


def main(reset=False, sector="medical"):
    db.init()
    with db.conn() as c:
        if reset:
            for t in ("verdicts", "overrides", "pr_tickets", "requirements", "tickets"):
                c.execute(f"DELETE FROM {t}")
            for t in ("verdict_extras", "pr_meta", "fix_feedback", "project", "ticket_meta"):
                try:
                    c.execute(f"DELETE FROM {t}")
                except Exception:
                    pass
        for tid, title, body in TICKETS:
            c.execute("INSERT INTO tickets(id, title, body) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, body=excluded.body",
                      (tid, title, body))
        for rid, text, tid in REQUIREMENTS:
            c.execute(
                """INSERT INTO requirements(req_id, text, ticket_id, sector) VALUES (?, ?, ?, ?)
                   ON CONFLICT(req_id) DO UPDATE SET text=excluded.text, ticket_id=excluded.ticket_id, sector=excluded.sector""",
                (rid, text, tid, sector),
            )
    print(f"Seeded {len(REQUIREMENTS)} requirements and {len(TICKETS)} tickets (sector={sector}).")


if __name__ == "__main__":
    main(reset="--reset" in sys.argv)
