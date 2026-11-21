"""Labeled tickets for the Sharpener eval. expected: 'vague' (<50), 'needs work' (50-74), 'precise' (>=75)."""
CASES = [
    # --- vague ---
    {"ticket": "Make the login page faster and more user-friendly.", "sector": None, "expected": "vague"},
    {"ticket": "Improve search so it works better.", "sector": None, "expected": "vague"},
    {"ticket": "The dashboard should be modern and easy to use.", "sector": None, "expected": "vague"},
    {"ticket": "Add a way for nurses to see patient records quickly and update medication info as needed.", "sector": "medical", "expected": "vague"},
    {"ticket": "Users should be able to transfer money between their accounts easily, with proper security and fees applied.", "sector": "finance", "expected": "vague"},
    {"ticket": "Make the app more secure and scalable.", "sector": None, "expected": "vague"},
    {"ticket": "Handle errors properly and show good messages.", "sector": None, "expected": "vague"},
    {"ticket": "Export reports in a reasonable amount of time.", "sector": None, "expected": "vague"},
    # --- needs work: some specifics, real gaps ---
    {"ticket": "The API must respond in under 200 ms, and it should handle many users.", "sector": None, "expected": "needs work"},
    {"ticket": "When a user resets their password, the system must send an email with a reset link that expires soon.", "sector": None, "expected": "needs work"},
    {"ticket": "Nurses must be able to view a patient's medication list. Updates must be logged.", "sector": "medical", "expected": "needs work"},
    {"ticket": "Transfers over $10,000 must be flagged for review. Fees are applied to each transfer.", "sector": "finance", "expected": "needs work"},
    {"ticket": "The upload endpoint must reject files larger than 10 MB and support common image formats.", "sector": None, "expected": "needs work"},
    # --- precise ---
    {"ticket": "When a user submits valid credentials, the login endpoint must return a session token in under 300 ms at p95 for 1,000 concurrent users.\nAfter 5 failed attempts within 10 minutes, the system must lock the account for 15 minutes and return HTTP 429.\nEvery failed attempt must be written to the audit log with user id, IP, and timestamp.", "sector": None, "expected": "precise"},
    {"ticket": "The /search endpoint must return at most 50 results per page, sorted by relevance score descending.\nWhen the query is empty, it must return HTTP 400 with the error code EMPTY_QUERY.\nP95 latency must be under 250 ms for an index of 1,000,000 documents.", "sector": None, "expected": "precise"},
    {"ticket": "When a nurse with role CLINICIAN opens a patient chart, the system must display the medication list within 2 seconds.\nEvery chart view must be written to the audit log with nurse id, patient id, and UTC timestamp.\nUsers without the CLINICIAN role must receive HTTP 403 and no patient data.\nPatient names and MRNs must not appear in application logs.", "sector": "medical", "expected": "precise"},
    {"ticket": "The transfer endpoint must store amounts as integer cents and reject any request with a negative or zero amount with HTTP 422.\nA request with a repeated Idempotency-Key within 24 hours must return the original response and must not move funds twice.\nTransfers over 10,000.00 USD must require approval by a second user.\nEach transfer must append a row to the audit log with user id, amounts, and UTC timestamp.", "sector": "finance", "expected": "precise"},
    {"ticket": "When a user clicks Export, the system must generate a CSV with columns id, name, created_at within 30 seconds for up to 100,000 rows.\nIf generation exceeds 30 seconds, the system must show the message 'Export is taking longer than expected' and email the file when ready.", "sector": None, "expected": "precise"},
    {"ticket": "The password reset link must expire 30 minutes after it is sent and be usable only once.\nWhen an expired or used link is opened, the system must show 'This link is no longer valid' and return HTTP 410.\nA user may request at most 3 reset emails per hour; the fourth request must return HTTP 429.", "sector": None, "expected": "precise"},
    {"ticket": "Uploaded images must be limited to JPEG and PNG, at most 10 MB each.\nWhen a file exceeds 10 MB or has another type, the system must reject it with HTTP 413 or 415 respectively and must not store the file.", "sector": None, "expected": "precise"},
]
