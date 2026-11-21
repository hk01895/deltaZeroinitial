// API client. Talks to the FastAPI backend when NEXT_PUBLIC_API_URL is set;
// otherwise (or if a request fails) it falls back to mock data so the UI
// always works for the demo.

import {
  mockCoverage,
  mockEval,
  mockPRReview,
  mockPRs,
  mockRerun,
  mockRulePacks,
} from "./mock";
import type {
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

async function withFallback<T>(live: () => Promise<T>, mock: () => T): Promise<T> {
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
