// Mock data used until the backend is live (and as a demo backup).
// Demo app: a small patient appointment API.

import type {
  Coverage,
  EvalResult,
  PRReview,
  PRSummary,
  RequirementVerdict,
  RulePack,
  Sector,
} from "./types";

const REPO = "https://github.com/hk01895/deltaZeroinitial";
const JIRA = "https://example.atlassian.net/browse";

const baseCoverage: Coverage = {
  project: "CareSlot – Patient Appointment API",
  spec_name: "careslot-prd-v1.md",
  updated_at: "2026-11-21T15:10:00Z",
  requirements: [
    { req_id: "REQ-001", text: "Patients can book an appointment by choosing a doctor and an open time slot.", status: "met", priority: "high", ticket_key: "CARE-12", ticket_url: `${JIRA}/CARE-12`, pr_id: 12, pr_url: `${REPO}/pull/12` },
    { req_id: "REQ-002", text: "Booking the same slot twice returns HTTP 409 and does not create a second appointment.", status: "met", priority: "high", ticket_key: "CARE-12", ticket_url: `${JIRA}/CARE-12`, pr_id: 12, pr_url: `${REPO}/pull/12` },
    { req_id: "REQ-003", text: "Patients receive a confirmation email within 60 seconds of booking.", status: "partial", priority: "medium", ticket_key: "CARE-12", ticket_url: `${JIRA}/CARE-12`, pr_id: 12, pr_url: `${REPO}/pull/12`, reason: "Email goes to a 5-minute batch job; the spec requires 60 seconds." },
    { req_id: "REQ-004", text: "Appointments can be cancelled up to 24 hours before the start time.", status: "missing", priority: "medium", ticket_key: "CARE-12", ticket_url: `${JIRA}/CARE-12`, pr_id: 12, pr_url: `${REPO}/pull/12`, drift: "Spec says 24 hours, ticket CARE-12 says 12 hours", reason: "No cancel endpoint in PR #12, and the ticket says 12 hours instead of 24." },
    { req_id: "REQ-005", text: "Every read of patient records is written to an audit log with user ID and timestamp.", status: "missing", priority: "high", ticket_key: "CARE-12", ticket_url: `${JIRA}/CARE-12`, pr_id: 12, pr_url: `${REPO}/pull/12`, reason: "The audit-log code the AI cited is not in the diff, so a person needs to check." },
    { req_id: "REQ-006", text: "Doctors can view their schedule for the next 7 days.", status: "met", priority: "medium", ticket_key: "CARE-9", ticket_url: `${JIRA}/CARE-9`, pr_id: 9, pr_url: `${REPO}/pull/9` },
    { req_id: "REQ-007", text: "Sessions expire after 15 minutes of inactivity.", status: "met", priority: "high", ticket_key: "CARE-7", ticket_url: `${JIRA}/CARE-7`, pr_id: 7, pr_url: `${REPO}/pull/7` },
    { req_id: "REQ-008", text: "Patient phone numbers are stored encrypted at rest.", status: "not_started", priority: "high", ticket_key: "CARE-15", ticket_url: `${JIRA}/CARE-15`, pr_id: null, pr_url: null, reason: "Ticket CARE-15 exists, but no one has opened a PR yet." },
    { req_id: "REQ-009", text: "Patients get an SMS reminder 24 hours before their appointment.", status: "never_ticketed", priority: "medium", ticket_key: null, ticket_url: null, pr_id: null, pr_url: null, reason: "It is in the spec, but no ticket was ever created." },
    { req_id: "REQ-010", text: "Patients can export their full appointment history as a PDF.", status: "never_ticketed", priority: "low", ticket_key: null, ticket_url: null, pr_id: null, pr_url: null, reason: "It is in the spec, but no ticket was ever created." },
  ],
};

// ---- PR #12 BEFORE the fix: 2/5 met --------------------------------------

const before: RequirementVerdict[] = [
  {
    req_id: "REQ-001",
    requirement: "Patients can book an appointment by choosing a doctor and an open time slot.",
    verdict: "met",
    confidence: 0.94,
    model: "lightning",
    thinking: false,
    latency_ms: 820,
    reasoning: "POST /appointments accepts doctor_id and slot_id and creates the appointment when the slot is open.",
    evidence: [
      {
        file: "api/routes/appointments.py",
        start_line: 18,
        end_line: 24,
        code: `@router.post("/appointments")\ndef book(req: BookingRequest, db=Depends(get_db)):\n    slot = db.get_slot(req.doctor_id, req.slot_id)\n    if not slot.is_open:\n        raise HTTPException(400, "Slot not available")\n    appt = db.create_appointment(req.patient_id, slot)\n    return appt`,
      },
    ],
    evidence_verified: true,
    suggested_diff: null,
    suggested_test: null,
  },
  {
    req_id: "REQ-002",
    requirement: "Booking the same slot twice returns HTTP 409 and does not create a second appointment.",
    verdict: "met",
    confidence: 0.88,
    model: "lightning",
    thinking: false,
    latency_ms: 910,
    reasoning: "A unique constraint on (doctor_id, slot_id) is caught and mapped to HTTP 409.",
    evidence: [
      {
        file: "api/routes/appointments.py",
        start_line: 26,
        end_line: 28,
        code: `    except IntegrityError:\n        db.rollback()\n        raise HTTPException(409, "Slot already booked")`,
      },
    ],
    evidence_verified: true,
    suggested_diff: null,
    suggested_test: null,
  },
  {
    req_id: "REQ-003",
    requirement: "Patients receive a confirmation email within 60 seconds of booking.",
    verdict: "partial",
    confidence: 0.71,
    model: "super",
    thinking: true,
    latency_ms: 4300,
    reasoning: "An email is queued after booking, but it goes to a batch job that runs every 5 minutes, so the 60-second limit is not met.",
    evidence: [
      {
        file: "api/services/notify.py",
        start_line: 10,
        end_line: 12,
        code: `def queue_confirmation(appt):\n    # picked up by batch_mailer (runs every 5 min)\n    outbox.add(appt.patient_email, "confirmation", appt.id)`,
      },
    ],
    evidence_verified: true,
    suggested_diff: `--- a/api/services/notify.py\n+++ b/api/services/notify.py\n@@ -8,5 +8,5 @@\n def queue_confirmation(appt):\n-    # picked up by batch_mailer (runs every 5 min)\n-    outbox.add(appt.patient_email, "confirmation", appt.id)\n+    # send immediately so the patient gets it within 60s\n+    mailer.send_now(appt.patient_email, "confirmation", appt.id)`,
    suggested_test: `def test_confirmation_sent_within_60s(client, fake_mailer, clock):\n    client.post("/appointments", json=BOOKING)\n    sent = fake_mailer.sent[-1]\n    assert sent.template == "confirmation"\n    assert sent.sent_at - clock.now() < timedelta(seconds=60)`,
  },
  {
    req_id: "REQ-004",
    requirement: "Appointments can be cancelled up to 24 hours before the start time.",
    verdict: "missing",
    confidence: 0.92,
    model: "lightning",
    thinking: false,
    latency_ms: 760,
    reasoning: "No cancel endpoint or cancellation logic appears in the diff.",
    evidence: [],
    evidence_verified: true,
    suggested_diff: `--- a/api/routes/appointments.py\n+++ b/api/routes/appointments.py\n@@ -30,0 +31,9 @@\n+@router.delete("/appointments/{appt_id}")\n+def cancel(appt_id: int, db=Depends(get_db)):\n+    appt = db.get_appointment(appt_id)\n+    if appt.start_time - datetime.utcnow() < timedelta(hours=24):\n+        raise HTTPException(400, "Cannot cancel within 24 hours")\n+    db.cancel(appt)\n+    return {"status": "cancelled"}`,
    suggested_test: `def test_cannot_cancel_within_24h(client, appt_in_10h):\n    r = client.delete(f"/appointments/{appt_in_10h.id}")\n    assert r.status_code == 400\n\ndef test_can_cancel_more_than_24h_ahead(client, appt_in_48h):\n    r = client.delete(f"/appointments/{appt_in_48h.id}")\n    assert r.json()["status"] == "cancelled"`,
  },
  {
    req_id: "REQ-005",
    requirement: "Every read of patient records is written to an audit log with user ID and timestamp.",
    verdict: "needs_human",
    confidence: 0.48,
    model: "super",
    thinking: true,
    latency_ms: 5200,
    reasoning: "The model claimed a decorator logs reads, but the quoted lines were not found in the diff, so Evidence Guard downgraded the verdict.",
    evidence: [
      {
        file: "api/routes/patients.py",
        start_line: 40,
        end_line: 41,
        code: `@audit_log(action="read_patient")\ndef get_patient(patient_id: int): ...`,
      },
    ],
    evidence_verified: false,
    downgraded_from: "met",
    suggested_diff: `--- a/api/routes/patients.py\n+++ b/api/routes/patients.py\n@@ -38,2 +38,3 @@\n @router.get("/patients/{patient_id}")\n+@audit_log(action="read_patient", fields=["user_id", "timestamp"])\n def get_patient(patient_id: int, user=Depends(current_user)):`,
    suggested_test: `def test_patient_read_is_audited(client, audit_store, doctor_token):\n    client.get("/patients/1", headers=doctor_token)\n    entry = audit_store.last()\n    assert entry.action == "read_patient"\n    assert entry.user_id and entry.timestamp`,
  },
];

// ---- PR #12 AFTER the fix commit: 5/5 met --------------------------------

const after: RequirementVerdict[] = before.map((v) => {
  if (v.verdict === "met") return v;
  const fixedEvidence: Record<string, RequirementVerdict["evidence"]> = {
    "REQ-003": [
      { file: "api/services/notify.py", start_line: 10, end_line: 12, code: `def queue_confirmation(appt):\n    # send immediately so the patient gets it within 60s\n    mailer.send_now(appt.patient_email, "confirmation", appt.id)` },
    ],
    "REQ-004": [
      { file: "api/routes/appointments.py", start_line: 31, end_line: 37, code: `@router.delete("/appointments/{appt_id}")\ndef cancel(appt_id: int, db=Depends(get_db)):\n    appt = db.get_appointment(appt_id)\n    if appt.start_time - datetime.utcnow() < timedelta(hours=24):\n        raise HTTPException(400, "Cannot cancel within 24 hours")\n    db.cancel(appt)\n    return {"status": "cancelled"}` },
    ],
    "REQ-005": [
      { file: "api/routes/patients.py", start_line: 38, end_line: 40, code: `@router.get("/patients/{patient_id}")\n@audit_log(action="read_patient", fields=["user_id", "timestamp"])\ndef get_patient(patient_id: int, user=Depends(current_user)):` },
    ],
  };
  return {
    ...v,
    verdict: "met",
    confidence: 0.9,
    model: "lightning",
    thinking: false,
    latency_ms: 880,
    reasoning: "Fix commit implements the requirement; evidence found in the diff and a matching test was added.",
    evidence: fixedEvidence[v.req_id] ?? v.evidence,
    evidence_verified: true,
    downgraded_from: null,
    suggested_diff: null,
    suggested_test: null,
  };
});

function review(verdicts: RequirementVerdict[], sha: string, sector: Sector): PRReview {
  return {
    pr_id: 12,
    title: "Add appointment booking endpoint",
    url: `${REPO}/pull/12`,
    ticket_key: "CARE-12",
    ticket_url: `${JIRA}/CARE-12`,
    branch: "CARE-12-booking",
    head_sha: sha,
    reviewed_at: new Date().toISOString(),
    sector,
    verdicts,
  };
}

// Mock state: first review shows 2/5, "Re-run" flips to the fixed commit.
let pr12Fixed = false;

export function mockPRReview(id: number, sector: Sector): PRReview {
  if (id !== 12) {
    return { ...review(after.slice(0, 2), "9c1e0aa", sector), pr_id: id, title: `PR #${id}` };
  }
  return pr12Fixed ? review(after, "f3b2c91", sector) : review(before, "a71d4e2", sector);
}

export function mockRerun(id: number, sector: Sector): PRReview {
  if (id === 12) pr12Fixed = true;
  return mockPRReview(id, sector);
}

// Demo-only: pretend the team shipped the last requirements so the Δ hits 0.
let sprintDone = false;
export function mockFinishSprint() {
  pr12Fixed = true;
  sprintDone = true;
}

export function mockResetDemo() {
  pr12Fixed = false;
  sprintDone = false;
}

// Coverage reflects the demo state: once PR #12 is fixed, REQ-003..005 flip to met.
const LATE: Record<string, { ticket_key: string; pr_id: number }> = {
  "REQ-008": { ticket_key: "CARE-15", pr_id: 14 },
  "REQ-009": { ticket_key: "CARE-16", pr_id: 14 },
  "REQ-010": { ticket_key: "CARE-17", pr_id: 14 },
};

export function mockCoverage(): Coverage {
  if (sprintDone) {
    return {
      ...baseCoverage,
      requirements: baseCoverage.requirements.map((r) => {
        const late = LATE[r.req_id];
        return {
          ...r,
          status: "met",
          drift: null,
          reason: null,
          ...(late
            ? { ticket_key: late.ticket_key, ticket_url: `${JIRA}/${late.ticket_key}`, pr_id: late.pr_id, pr_url: `${REPO}/pull/${late.pr_id}` }
            : {}),
        };
      }),
    };
  }
  if (!pr12Fixed) return baseCoverage;
  return {
    ...baseCoverage,
    requirements: baseCoverage.requirements.map((r) =>
      ["REQ-003", "REQ-004", "REQ-005"].includes(r.req_id) ? { ...r, status: "met", drift: null, reason: null } : r,
    ),
  };
}

export const mockPRs = (): PRSummary[] => [
  ...(sprintDone
    ? [{ pr_id: 14, title: "SMS reminders, PDF export, encrypted phone numbers", ticket_key: "CARE-15", met: 3, total: 3, updated_at: "2026-11-21T17:40:00Z" }]
    : []),
  { pr_id: 12, title: "Add appointment booking endpoint", ticket_key: "CARE-12", met: pr12Fixed ? 5 : 2, total: 5, updated_at: "2026-11-21T15:02:00Z" },
  { pr_id: 9, title: "Doctor weekly schedule view", ticket_key: "CARE-9", met: 1, total: 1, updated_at: "2026-11-20T21:40:00Z" },
  { pr_id: 7, title: "Session timeout", ticket_key: "CARE-7", met: 1, total: 1, updated_at: "2026-11-20T18:15:00Z" },
];

export const mockEval: EvalResult = {
  run_at: "2026-11-21T16:30:00Z",
  n_cases: 30,
  precision: 0.889,
  recall: 0.941,
  false_positive_rate: 0.154,
  labels: ["met", "partial", "missing", "needs_human"],
  confusion: [
    [9, 1, 0, 0],
    [1, 6, 1, 0],
    [0, 1, 8, 0],
    [0, 0, 1, 2],
  ],
  latency: {
    fast_avg_ms: 850,
    deep_avg_ms: 4700,
    fast_share: 0.7,
    routed_avg_ms: 2005,
    all_deep_avg_ms: 4700,
  },
};

export const mockRulePacks: Record<Sector, RulePack> = {
  general: {
    sector: "general",
    name: "General software",
    rules: [
      { id: "GEN-1", text: "Every requirement must cite code evidence or be marked needs_human." },
      { id: "GEN-2", text: "New endpoints need at least one test." },
    ],
  },
  medical: {
    sector: "medical",
    name: "Medical / health data",
    rules: [
      { id: "MED-1", text: "Every safety-related requirement must have a linked test." },
      { id: "MED-2", text: "Reads of patient data must be audit-logged (user ID + timestamp)." },
      { id: "MED-3", text: "Patient identifiers must be encrypted at rest." },
      { id: "MED-4", text: "Changes touching dosing or clinical logic are always flagged for human review." },
    ],
  },
  finance: {
    sector: "finance",
    name: "Finance / payments",
    rules: [
      { id: "FIN-1", text: "Every money-moving change needs an audit log entry." },
      { id: "FIN-2", text: "Payment endpoints must be idempotent (idempotency key required)." },
      { id: "FIN-3", text: "Rounding must match the spec exactly (banker's rounding unless stated)." },
      { id: "FIN-4", text: "Transfers above the approval threshold require a second approver." },
    ],
  },
};
