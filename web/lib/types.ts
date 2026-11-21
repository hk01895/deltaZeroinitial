// Shared JSON contract between the backend (Shreya), AI engine (Shreenidhi)
// and frontend (Haasika). See docs/api-contract.md. Keep field names in sync.

export type Verdict = "met" | "partial" | "missing" | "needs_human";

export type Sector = "general" | "medical" | "finance";

export interface Evidence {
  file: string;
  start_line: number;
  end_line: number;
  code: string;
}

export interface Override {
  id: string;
  pr_id: number;
  req_id: string;
  original_verdict: Verdict;
  new_verdict: Verdict;
  reason: string;
  author: string;
  created_at: string; // ISO timestamp
}

export interface RequirementVerdict {
  req_id: string;
  requirement: string;
  verdict: Verdict;
  confidence: number; // 0..1
  model: "lightning" | "super";
  thinking: boolean;
  latency_ms: number;
  reasoning: string;
  evidence: Evidence[];
  evidence_verified: boolean; // Evidence Guard result
  downgraded_from?: Verdict | null; // set when Evidence Guard downgraded to needs_human
  suggested_diff?: string | null; // unified diff text
  suggested_test?: string | null;
  override?: Override | null;
}

export interface PRReview {
  pr_id: number;
  title: string;
  url: string;
  ticket_key: string;
  ticket_url: string;
  branch: string;
  head_sha: string;
  reviewed_at: string;
  sector: Sector;
  verdicts: RequirementVerdict[];
}

export interface PRSummary {
  pr_id: number;
  title: string;
  ticket_key: string;
  met: number;
  total: number;
  updated_at: string;
}

export type CoverageStatus =
  | "met"
  | "partial"
  | "missing"
  | "never_ticketed"
  | "not_started";

export interface CoverageRow {
  req_id: string;
  text: string;
  status: CoverageStatus;
  priority: "high" | "medium" | "low";
  ticket_key: string | null;
  ticket_url: string | null;
  pr_id: number | null;
  pr_url: string | null;
  drift?: string | null; // e.g. "Spec says 15 min, ticket says 30 min"
  reason?: string | null; // one plain-language line on why it is not met (null when met)
}

export interface Coverage {
  project: string;
  spec_name: string;
  updated_at: string;
  requirements: CoverageRow[];
}

export interface EvalResult {
  run_at: string;
  n_cases: number;
  // Positive class = "gap" (actual partial or missing).
  precision: number;
  recall: number;
  false_positive_rate: number;
  labels: Verdict[]; // order of rows/cols in confusion
  confusion: number[][]; // rows = actual, cols = predicted
  latency: {
    fast_avg_ms: number; // Lightning, thinking off
    deep_avg_ms: number; // Super, thinking on
    fast_share: number; // 0..1 share of checks handled by fast path
    routed_avg_ms: number; // our router, blended
    all_deep_avg_ms: number; // baseline: everything on Super w/ thinking
  };
}

export interface RulePack {
  sector: Sector;
  name: string;
  rules: { id: string; text: string }[];
}

export interface TicketDraft {
  req_id: string;
  title: string;
  description: string;
  acceptance_criteria: string[];
  precision_score: number; // 0..100 from the Ticket Sharpener
  issues: string[]; // what the sharpener fixed or still flags
}

export interface CreatedTicket {
  ticket_key: string;
  ticket_url: string;
}

export interface FixSuggestion {
  suggested_diff: string;
  suggested_test: string;
  note: string; // how the AI used the reviewer's feedback
}

export interface OverrideRequest {
  pr_id: number;
  req_id: string;
  new_verdict: Verdict;
  reason: string;
  author: string;
}
