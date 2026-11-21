"use client";

import Icon from "./Icon";
import type { CoverageRow } from "@/lib/types";
import { card, eyebrow } from "@/lib/ui";

// Shown at the very end of the overview: follow-up tickets for requirements
// a pull request touched but didn't finish. (Lost requirements have their own card above.)
export function suggestionsFrom(rows: CoverageRow[]) {
  return rows.filter((r) => r.pr_id && (r.status === "partial" || r.status === "missing"));
}

export default function SuggestedTickets({ rows, onCreate }: { rows: CoverageRow[]; onCreate: (r: CoverageRow) => void }) {
  const items = suggestionsFrom(rows);
  return (
    <section aria-labelledby="suggested-title" className={`${card} p-5 sm:p-6`}>
      <p className={eyebrow}>To make it better</p>
      <h2 id="suggested-title" className="mt-1 text-lg font-semibold tracking-tight text-slate-50">
        Suggested tickets
      </h2>
      <p className="text-sm text-slate-300">Follow-ups for what a pull request didn&apos;t finish. One click drafts the ticket.</p>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-400">No suggestions right now. Every checked PR fully covers what it touched.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((r) => (
            <li key={r.req_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-700 bg-navy-950/50 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs text-slate-400">
                  {r.req_id} · from PR #{r.pr_id}
                </p>
                <p className="text-[15px] leading-6 text-slate-100">{r.text}</p>
                {r.reason && <p className="mt-0.5 text-sm leading-6 text-slate-400">Missing: {r.reason}</p>}
              </div>
              {r.follow_up ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-emerald-300">
                  <Icon name="check" className="h-4 w-4" /> {r.follow_up} created
                </span>
              ) : (
                <button
                  onClick={() => onCreate(r)}
                  className="shrink-0 rounded-md border border-cyan-300/40 bg-cyan-400/10 px-3 py-1.5 text-sm font-medium text-cyan-100 hover:bg-cyan-400/20"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name="plus" className="h-4 w-4" /> Create follow-up
                  </span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
