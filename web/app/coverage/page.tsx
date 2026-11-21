"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCoverage } from "@/lib/api";
import type { Coverage, CoverageStatus } from "@/lib/types";
import { useSector } from "@/components/SectorProvider";
import StatusBadge, { STATUS_LABEL } from "@/components/StatusBadge";
import StatCard from "@/components/StatCard";

type Filter = "all" | CoverageStatus;
const FILTERS: Filter[] = ["all", "met", "partial", "missing", "never_ticketed", "not_started"];

const PRIORITY_CLS = {
  high: "bg-rose-50 text-rose-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-slate-100 text-slate-600",
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

  if (!data) return <p className="text-sm text-slate-500">Loading coverage…</p>;

  const total = data.requirements.length;
  const pct = total ? Math.round((counts.met / total) * 100) : 0;
  const rows = data.requirements.filter((r) => filter === "all" || r.status === filter);
  const drifted = data.requirements.filter((r) => r.drift);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Coverage Map</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every requirement in <span className="font-mono">{data.spec_name}</span>, traced from spec → ticket → PR.
        </p>
      </div>

      {/* Headline */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm text-slate-500">Requirements delivered</p>
            <p className="text-4xl font-semibold tabular-nums">
              {counts.met}
              <span className="text-2xl text-slate-400">/{total}</span>
            </p>
          </div>
          {counts.never_ticketed > 0 && (
            <p className="rounded-lg bg-orange-100 px-3 py-2 text-sm font-semibold text-orange-800">
              ⚠ {counts.never_ticketed} requirement{counts.never_ticketed > 1 ? "s" : ""} never became a ticket
            </p>
          )}
        </div>
        <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-slate-100">
          {(["met", "partial", "missing", "not_started", "never_ticketed"] as CoverageStatus[]).map((s) => {
            const w = total ? (counts[s] / total) * 100 : 0;
            const color = {
              met: "bg-emerald-500",
              partial: "bg-amber-400",
              missing: "bg-rose-500",
              not_started: "bg-slate-300",
              never_ticketed: "bg-orange-500",
            }[s];
            return w > 0 ? <div key={s} className={color} style={{ width: `${w}%` }} title={`${STATUS_LABEL[s]}: ${counts[s]}`} /> : null;
          })}
        </div>
        <p className="mt-2 text-xs text-slate-500">{pct}% of the original spec is shipped.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard label="Met" value={counts.met} tone="emerald" />
        <StatCard label="Partial" value={counts.partial} tone="amber" />
        <StatCard label="Missing" value={counts.missing} tone="rose" />
        <StatCard label="Not started" value={counts.not_started} />
        <StatCard label="Never ticketed" value={counts.never_ticketed} tone="orange" />
      </div>

      {drifted.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-semibold text-amber-900">Drift detected</p>
          <ul className="mt-1 space-y-1 text-sm text-amber-900">
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
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                active ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {f === "all" ? "All" : STATUS_LABEL[f]} <span className="tabular-nums opacity-70">{n}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3">Requirement</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ticket</th>
              <th className="px-4 py-3">PR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const never = r.status === "never_ticketed";
              return (
                <tr key={r.req_id} className={never ? "bg-orange-50" : "hover:bg-slate-50"}>
                  <td className={`px-4 py-3 font-mono text-xs font-semibold ${never ? "border-l-4 border-orange-500" : ""}`}>
                    {r.req_id}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-800">{r.text}</p>
                    {r.drift && <p className="mt-1 text-xs text-amber-700">↯ {r.drift}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_CLS[r.priority]}`}>{r.priority}</span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3">
                    {r.ticket_key ? (
                      <a href={r.ticket_url ?? "#"} target="_blank" rel="noreferrer" className="font-mono text-xs text-indigo-600 hover:underline">
                        {r.ticket_key}
                      </a>
                    ) : (
                      <Link
                        href={`/sharpener?req=${encodeURIComponent(r.req_id)}&text=${encodeURIComponent(r.text)}`}
                        className="whitespace-nowrap rounded-md bg-orange-600 px-2 py-1 text-xs font-medium text-white hover:bg-orange-700"
                      >
                        Draft ticket
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.pr_id ? (
                      <Link href={`/pr/${r.pr_id}`} className="font-mono text-xs text-indigo-600 hover:underline">
                        #{r.pr_id}
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
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
