"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getPRs } from "@/lib/api";
import type { PRSummary } from "@/lib/types";
import { card } from "@/lib/ui";
import { BackLink } from "@/components/AppShell";

export default function PRListPage() {
  const [prs, setPrs] = useState<PRSummary[] | null>(null);

  useEffect(() => {
    getPRs().then(setPrs);
  }, []);

  return (
    <div className="space-y-6">
      <BackLink />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">PR Reviews</h1>
        <p className="mt-1 text-sm text-slate-400">Each PR checked against the requirements of its linked ticket.</p>
      </div>
      {!prs ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className={`${card} divide-y divide-navy-700/60 overflow-hidden`}>
          {prs.map((p) => {
            const done = p.met === p.total;
            return (
              <Link key={p.pr_id} href={`/pr/${p.pr_id}`} className="flex items-center gap-4 px-5 py-4 transition hover:bg-navy-850/70">
                <span className="font-mono text-sm text-slate-500">#{p.pr_id}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-100">{p.title}</p>
                  <p className="text-xs text-slate-500">{p.ticket_key}</p>
                </div>
                <div className="w-40">
                  <div className="h-1.5 overflow-hidden rounded-full bg-navy-800">
                    <div
                      className={`h-full ${done ? "bg-emerald-400" : "bg-amber-300"}`}
                      style={{ width: `${p.total ? (p.met / p.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <span className={`w-14 text-right text-sm font-semibold tabular-nums ${done ? "text-emerald-300" : "text-amber-200"}`}>
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
