"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCoverage } from "@/lib/api";
import type { Coverage, CoverageStatus } from "@/lib/types";
import { useSector } from "@/components/SectorProvider";
import StatusBadge, { STATUS_BAR, STATUS_LABEL } from "@/components/StatusBadge";
import StatCard from "@/components/StatCard";
import { card, eyebrow, glow, link } from "@/lib/ui";

type Filter = "all" | CoverageStatus;
const FILTERS: Filter[] = ["all", "met", "partial", "missing", "never_ticketed", "not_started"];

const PRIORITY_CLS = {
  high: "text-rose-300",
  medium: "text-amber-200",
  low: "text-slate-400",
};

export default function CoveragePage() {
  const { sector } = useSector();
  const [data, setData] = useState<Coverage | null>(null);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let alive = true;
    getCoverage(sector).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [sector]);

  const counts = useMemo(() => {
    const c: Record<CoverageStatus, number> = { met: 0, partial: 0, missing: 0, never_ticketed: 0, not_started: 0 };
    data?.requirements.forEach((r) => c[r.status]++);
    return c;
  }, [data]);

  if (!data) return <p className="text-sm text-slate-400">Loading coverage…</p>;

  const total = data.requirements.length;
  const pct = total ? Math.round((counts.met / total) * 100) : 0;
  const rows = data.requirements.filter((r) => filter === "all" || r.status === filter);
  const drifted = data.requirements.filter((r) => r.drift);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Coverage Map</h1>
        <p className="mt-1 text-sm text-slate-400">
          Every requirement in <span className="font-mono text-slate-300">{data.spec_name}</span>, traced from spec → ticket → PR.
        </p>
      </div>

      {/* Headline */}
      <div className={`${card} ${glow} p-5`}>
        <div className="flex items-end justify-between">
          <div>
            <p className={eyebrow}>Requirements delivered</p>
            <p className="mt-1 text-5xl font-semibold tabular-nums text-cyan-100 [text-shadow:0_0_22px_rgba(103,232,249,0.35)]">
              {counts.met}
              <span className="text-3xl text-slate-500">/{total}</span>
            </p>
          </div>
          {counts.never_ticketed > 0 && (
            <p className="rounded-lg border border-orange-400/30 bg-orange-400/10 px-3 py-2 text-sm font-semibold text-orange-200">
              ⚠ {counts.never_ticketed} requirement{counts.never_ticketed > 1 ? "s" : ""} never became a ticket
            </p>
          )}
        </div>
        <div className="mt-5 flex h-2 gap-0.5 overflow-hidden rounded-full bg-navy-800">
          {(["met", "partial", "missing", "not_started", "never_ticketed"] as CoverageStatus[]).map((s) => {
            const w = total ? (counts[s] / total) * 100 : 0;
            return w > 0 ? (
              <div key={s} className={`${STATUS_BAR[s]} opacity-90`} style={{ width: `${w}%` }} title={`${STATUS_LABEL[s]}: ${counts[s]}`} />
            ) : null;
          })}
        </div>
        <p className="mt-2 text-xs text-slate-400">{pct}% of the original spec is shipped.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Met" value={counts.met} tone="emerald" />
        <StatCard label="Partial" value={counts.partial} tone="amber" />
        <StatCard label="Missing" value={counts.missing} tone="rose" />
        <StatCard label="Not started" value={counts.not_started} />
        <StatCard label="Never ticketed" value={counts.never_ticketed} tone="orange" />
      </div>

      {drifted.length > 0 && (
        <div className="rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-4">
          <p className="text-sm font-semibold text-amber-200">Drift detected</p>
          <ul className="mt-1 space-y-1 text-sm text-amber-100/90">
            {drifted.map((r) => (
              <li key={r.req_id}>
                <span className="font-mono">{r.req_id}</span>: {r.drift}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const n = f === "all" ? total : counts[f];
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                active
                  ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100 shadow-[0_0_16px_-8px_rgba(103,232,249,0.7)]"
                  : "border-navy-700 bg-navy-900/60 text-slate-400 hover:border-navy-600 hover:text-slate-200"
              }`}
            >
              {f === "all" ? "All" : STATUS_LABEL[f]} <span className="tabular-nums opacity-60">{n}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className={`${card} overflow-hidden`}>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-navy-700 bg-navy-850/80">
            <tr className={eyebrow}>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Requirement</th>
              <th className="px-4 py-3 font-medium">Priority</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Ticket</th>
              <th className="px-4 py-3 font-medium">PR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-700/60">
            {rows.map((r) => {
              const never = r.status === "never_ticketed";
              return (
                <tr key={r.req_id} className={never ? "bg-orange-400/[0.06]" : "hover:bg-navy-850/70"}>
                  <td
                    className={`whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-slate-300 ${
                      never ? "shadow-[inset_3px_0_0_0_rgba(251,146,60,0.8)]" : ""
                    }`}
                  >
                    {r.req_id}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-100">{r.text}</p>
                    {r.drift && <p className="mt-1 text-xs text-amber-200/90">↯ {r.drift}</p>}
                  </td>
                  <td className={`px-4 py-3 text-xs font-medium capitalize ${PRIORITY_CLS[r.priority]}`}>{r.priority}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    {r.ticket_key ? (
                      <a href={r.ticket_url ?? "#"} target="_blank" rel="noreferrer" className={`font-mono text-xs ${link}`}>
                        {r.ticket_key}
                      </a>
                    ) : (
                      <Link
                        href={`/sharpener?req=${encodeURIComponent(r.req_id)}&text=${encodeURIComponent(r.text)}`}
                        className="whitespace-nowrap rounded-md border border-orange-300/40 bg-orange-400/10 px-2 py-1 text-xs font-medium text-orange-200 hover:bg-orange-400/20"
                      >
                        Draft ticket
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.pr_id ? (
                      <Link href={`/pr/${r.pr_id}`} className={`font-mono text-xs ${link}`}>
                        #{r.pr_id}
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
