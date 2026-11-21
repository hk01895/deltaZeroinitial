"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPRs } from "@/lib/api";
import type { PRSummary } from "@/lib/types";

export default function PRListPage() {
  const [prs, setPrs] = useState<PRSummary[] | null>(null);

  useEffect(() => {
    getPRs().then(setPrs);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">PR Reviews</h1>
        <p className="mt-1 text-sm text-slate-500">Each PR checked against the requirements of its linked ticket.</p>
      </div>
      {!prs ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {prs.map((p) => {
            const done = p.met === p.total;
            return (
              <Link key={p.pr_id} href={`/pr/${p.pr_id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50">
                <span className="font-mono text-sm text-slate-500">#{p.pr_id}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{p.title}</p>
                  <p className="text-xs text-slate-500">{p.ticket_key}</p>
                </div>
                <div className="w-40">
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full ${done ? "bg-emerald-500" : "bg-amber-400"}`}
                      style={{ width: `${p.total ? (p.met / p.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <span className={`w-14 text-right text-sm font-semibold tabular-nums ${done ? "text-emerald-600" : "text-amber-600"}`}>
                  {p.met}/{p.total}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
