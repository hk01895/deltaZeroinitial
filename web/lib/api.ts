// API client. Talks to the FastAPI backend when NEXT_PUBLIC_API_URL is set;
// otherwise (or if a request fails) it falls back to mock data so the UI
// always works for the demo.

import {
  mockCoverage,
  mockEval,
  mockFinishSprint,
  mockCreateTicket,
  mockDraftTicket,
  mockRegenerateFix,
  mockResetDemo,
  mockPRReview,
  mockPRs,
  mockRerun,
  mockRulePacks,
} from "./mock";
import type {
  CoverageRow,
  CreatedTicket,
  FixSuggestion,
  TicketDraft,
  Coverage,
  EvalResult,
  Override,
  OverrideRequest,
  PRReview,
  PRSummary,
  RulePack,
  Sector,
} from "./types";

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
export const USING_MOCK = !API_URL || process.env.NEXT_PUBLIC_USE_MOCK === "true";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function withFallback<T>(live: () => Promise<T>, mock: () => T | Promise<T>): Promise<T> {
  if (USING_MOCK) return mock();
  try {
    return await live();
  } catch (err) {
    console.warn("[deltazero] API failed, using mock data:", err);
    return mock();
  }
}

// ---- Mock-mode overrides (kept in memory for the session) ----------------
const mockOverrides: Override[] = [];

function applyMockOverrides(review: PRReview): PRReview {
  return {
    ...review,
    verdicts: review.verdicts.map((v) => {
      const o = [...mockOverrides]
        .reverse()
        .find((x) => x.pr_id === review.pr_id && x.req_id === v.req_id);
      return o ? { ...v, verdict: o.new_verdict, override: o } : v;
    }),
  };
}

// ---- Endpoints ------------------------------------------------------------

/** Demo-only (mock mode): put the demo back to the start (PR #12 at 2/5, Δ 6). */
export function resetDemo() {
  if (USING_MOCK) mockResetDemo();
}

/** Demo-only (mock mode): mark every remaining requirement shipped so the Δ reaches 0. */
export function finishDemoSprint() {
  mockFinishSprint();
}

export function getCoverage(sector: Sector): Promise<Coverage> {
  return withFallback(
    () => request<Coverage>(`/coverage?sector=${sector}`),
    mockCoverage,
  );
}

export function getPRs(): Promise<PRSummary[]> {
  return withFallback(() => request<PRSummary[]>(`/prs`), mockPRs);
}

export function getPRReview(id: number, sector: Sector): Promise<PRReview> {
  return withFallback(
    () => request<PRReview>(`/prs/${id}/review?sector=${sector}`),
    () => applyMockOverrides(mockPRReview(id, sector)),
  );
}

export function rerunPR(id: number, sector: Sector): Promise<PRReview> {
  return withFallback(
    () => request<PRReview>(`/prs/${id}/rerun?sector=${sector}`, { method: "POST" }),
    () => applyMockOverrides(mockRerun(id, sector)),
  );
}

export function postOverride(body: OverrideRequest, originalVerdict: Override["original_verdict"]): Promise<Override> {
  return withFallback(
    () => request<Override>(`/overrides`, { method: "POST", body: JSON.stringify(body) }),
    () => {
      const o: Override = {
        id: `ovr-${mockOverrides.length + 1}`,
        pr_id: body.pr_id,
        req_id: body.req_id,
        original_verdict: originalVerdict,
        new_verdict: body.new_verdict,
        reason: body.reason,
        author: body.author,
        created_at: new Date().toISOString(),
      };
      mockOverrides.push(o);
      return o;
    },
  );
}

export function getOverrides(): Promise<Override[]> {
  return withFallback(() => request<Override[]>(`/overrides`), () => [...mockOverrides]);
}

export function getEval(): Promise<EvalResult> {
  return withFallback(() => request<EvalResult>(`/eval`), () => mockEval);
}

export function getRulePack(sector: Sector): Promise<RulePack> {
  return withFallback(
    () => request<RulePack>(`/rulepacks/${sector}`),
    () => mockRulePacks[sector],
  );
}

// ---- Tickets (Lost requirements → "Create ticket") -------------------------

export function draftTicket(row: CoverageRow): Promise<TicketDraft> {
  return withFallback(
    () => request<TicketDraft>(`/tickets/draft`, { method: "POST", body: JSON.stringify({ req_id: row.req_id, text: row.text }) }),
    () => mockDraftTicket(row),
  );
}

export function createTicket(draft: TicketDraft): Promise<CreatedTicket> {
  return withFallback(
    () => request<CreatedTicket>(`/tickets`, { method: "POST", body: JSON.stringify(draft) }),
    () => mockCreateTicket(draft.req_id),
  );
}

// ---- "Not the fix I want": regenerate a suggestion from reviewer feedback ---

const fixAttempts: Record<string, number> = {};
export function regenerateFix(prId: number, reqId: string, feedback: string): Promise<FixSuggestion> {
  const k = `${prId}:${reqId}`;
  const attempt = (fixAttempts[k] = (fixAttempts[k] ?? -1) + 1);
  return withFallback(
    () => request<FixSuggestion>(`/prs/${prId}/fixes/${reqId}`, { method: "POST", body: JSON.stringify({ feedback }) }),
    async () => {
      await new Promise((r) => setTimeout(r, 700));
      return mockRegenerateFix(reqId, feedback, attempt);
    },
  );
}

// ---- GitHub: check any PR by pasting its link ---------------------------------

export function parsePRLink(url: string): { owner: string; repo: string; number: number } | null {
  const m = url.trim().match(/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/i);
  return m ? { owner: m[1], repo: m[2], number: Number(m[3]) } : null;
}

export function checkPRLink(url: string): Promise<{ pr_id: number }> {
  const parsed = parsePRLink(url);
  return withFallback(
    () => request<{ pr_id: number }>(`/prs/check`, { method: "POST", body: JSON.stringify({ url }) }),
    () => {
      if (!parsed) throw new Error("That doesn't look like a GitHub pull request link.");
      return { pr_id: parsed.number };
    },
  );
}
