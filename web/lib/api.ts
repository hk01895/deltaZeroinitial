// API client for the DeltaZero backend (backend/ui_api.py, mounted at /ui).
// No demo or sample data: everything shown comes from the project you load.

import type {
  Coverage,
  CoverageRow,
  CreatedTicket,
  EvalResult,
  FixSuggestion,
  Override,
  OverrideRequest,
  PRReview,
  PRSummary,
  ProjectLoadRequest,
  ProjectLoadResult,
  ProjectStatus,
  RulePack,
  Sector,
  TicketDraft,
} from "./types";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/ui").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
      cache: "no-store",
    });
  } catch {
    throw new Error(`Can't reach the DeltaZero backend at ${API_URL}. Is it running?`);
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.detail ?? "";
    } catch {
      /* not JSON */
    }
    throw new Error(detail ? String(detail) : `${init?.method ?? "GET"} ${path} → ${res.status}`);
  }
  return (await res.json()) as T;
}

const post = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });

// ---- Project ----------------------------------------------------------------

export function loadProject(body: ProjectLoadRequest): Promise<ProjectLoadResult> {
  return post<ProjectLoadResult>(`/projects`, body);
}

export async function getCurrentProject(): Promise<ProjectStatus | null> {
  try {
    return await request<ProjectStatus>(`/projects/current`);
  } catch {
    return null;
  }
}

// ---- Coverage + PRs ---------------------------------------------------------------

export function getCoverage(sector: Sector): Promise<Coverage> {
  return request<Coverage>(`/coverage?sector=${sector}`);
}

export function getPRs(): Promise<PRSummary[]> {
  return request<PRSummary[]>(`/prs`);
}

export function getPRReview(id: number, sector: Sector): Promise<PRReview> {
  return request<PRReview>(`/prs/${id}/review?sector=${sector}`);
}

export function rerunPR(id: number, sector: Sector): Promise<PRReview> {
  return post<PRReview>(`/prs/${id}/rerun?sector=${sector}`);
}

export function parsePRLink(url: string): { owner: string; repo: string; number: number } | null {
  const m = url.trim().match(/github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/i);
  return m ? { owner: m[1], repo: m[2], number: Number(m[3]) } : null;
}

export function checkPRLink(url: string): Promise<{ pr_id: number }> {
  if (!parsePRLink(url)) return Promise.reject(new Error("That doesn't look like a GitHub pull request link."));
  return post<{ pr_id: number }>(`/prs/check`, { url });
}

// ---- Overrides + fixes ------------------------------------------------------------

export function postOverride(body: OverrideRequest, _originalVerdict?: Override["original_verdict"]): Promise<Override> {
  return post<Override>(`/overrides`, body);
}

export function getOverrides(): Promise<Override[]> {
  return request<Override[]>(`/overrides`);
}

export function regenerateFix(prId: number, reqId: string, feedback: string): Promise<FixSuggestion> {
  return post<FixSuggestion>(`/prs/${prId}/fixes/${reqId}`, { feedback });
}

// ---- Tickets (Lost requirements → Create ticket) ---------------------------------

export function draftTicket(row: CoverageRow, sector?: Sector): Promise<TicketDraft> {
  return post<TicketDraft>(`/tickets/draft`, { req_id: row.req_id, text: row.text, sector });
}

export function createTicket(draft: TicketDraft): Promise<CreatedTicket> {
  return post<CreatedTicket>(`/tickets`, draft);
}

// ---- Rule packs, eval, sharpener ---------------------------------------------------

export function getRulePack(sector: Sector): Promise<RulePack> {
  return request<RulePack>(`/rulepacks/${sector}`);
}

export function getEval(): Promise<EvalResult> {
  return request<EvalResult>(`/eval`);
}

export interface SharpenResult {
  score: number;
  grade: string;
  issues: { type: string; text: string; why: string; fix: string }[];
  rewrite: string;
  acceptance_criteria: string[];
  sub_scores?: Record<string, number> | null;
  redundancy?: { status: string; explanation?: string; file?: string; matches?: { file: string; start: number; end: number; score: number }[] };
  fallback?: boolean;
  note?: string;
}

export function sharpen(ticket: string, sector: Sector): Promise<SharpenResult> {
  return post<SharpenResult>(`/sharpen`, { ticket, sector });
}
