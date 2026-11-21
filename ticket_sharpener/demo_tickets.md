# Demo tickets for the Sharpener (paste these live)

## 1. General: the classic vague one (expect score ~15-30)
Make the login page faster and more user-friendly. It should handle a lot of users and be secure.

## 2. Medical (sector = medical)
Add a way for nurses to see patient records quickly and update medication info as needed.

## 3. Finance (sector = finance)
Users should be able to transfer money between their accounts easily, with proper security and fees applied.

## 4. The "after" example: what a sharpened one looks like (expect 85+)
When a user submits valid credentials, the login endpoint must return a session token in under 300 ms at p95 for 1,000 concurrent users.
After 5 failed attempts within 10 minutes, the system must lock the account for 15 minutes and return HTTP 429.
Every failed attempt must be written to the audit log with user id, IP, and timestamp.

## 5. Redundancy demo (works once the demo repo has this already)
Pick one feature that already exists in the demo repo (e.g. "rate limit login attempts") and write it as a ticket.
The Sharpener should warn: "already implemented in <file>".
