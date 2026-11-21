"use client";

import { useEffect, useState } from "react";
import { getEval } from "@/lib/api";
import type { EvalResult } from "@/lib/types";
import StatCard from "@/components/StatCard";
import { STATUS_LABEL } from "@/components/StatusBadge";

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

export default function EvalPage() {
  const [data, setData] = useState<EvalResult | null>(null);

  useEffect(() => {
    getEval().then(setData);
  }, []);

  if (!data) return <p className="text-sm text-slate-500">Loading eval…</p>;

  const maxCell = Math.max(1, ...data.confusion.flat());
  const { latency } = data;
  const maxLat = Math.max(latency.all_deep_avg_ms, latency.routed_avg_ms, latency.fast_avg_ms, 1);
  const speedup = latency.routed_avg_ms ? latency.all_deep_avg_ms / latency.routed_avg_ms : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Eval</h1>
        <p className="mt-1 text-sm text-slate-500">
          {data.n_cases} labeled requirement/PR cases. A &ldquo;positive&rdquo; is a real gap (partial or missing).
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Precision" value={pct(data.precision)} sub="When we flag a gap, how often it's real" tone="indigo" />
        <StatCard label="Recall" value={pct(data.recall)} sub="Share of real gaps we catch" tone="emerald" />
        <StatCard label="False-positive rate" value={pct(data.false_positive_rate)} sub="Done work wrongly flagged as a gap" tone="rose" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Confusion matrix */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold">Confusion matrix</p>
          <p className="text-xs text-slate-500">Rows = actual · columns = DeltaZero&rsquo;s verdict</p>
          <div className="mt-4 overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th />
                  {data.labels.map((l) => (
                    <th key={l} className="px-2 pb-2 text-xs font-medium text-slate-500">
                      {STATUS_LABEL[l]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.confusion.map((row, i) => (
                  <tr key={i}>
                    <th className="pr-3 text-right text-xs font-medium text-slate-500">{STATUS_LABEL[data.labels[i]]}</th>
                    {row.map((n, j) => {
                      const diag = i === j;
                      const alpha = n / maxCell;
                      return (
                        <td key={j} className="p-1">
                          <div
                            className={`flex h-12 w-20 items-center justify-center rounded-md font-semibold tabular-nums ${
                              alpha > 0.5 ? "text-white" : "text-slate-800"
                            }`}
                            style={{
                              backgroundColor: diag
                                ? `rgba(16, 185, 129, ${0.08 + alpha * 0.85})`
                                : `rgba(244, 63, 94, ${n ? 0.12 + alpha * 0.8 : 0.04})`,
                            }}
                          >
                            {n}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Latency */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold">Fast/deep thinking router</p>
          <p className="text-xs text-slate-500">
            {Math.round(latency.fast_share * 100)}% of checks resolved on the fast path · {speedup.toFixed(1)}× faster than running
            everything on Super with thinking on
          </p>
          <div className="mt-5 space-y-4">
            {[
              { label: "Lightning · thinking off", ms: latency.fast_avg_ms, cls: "bg-lime-500" },
              { label: "Super · thinking on", ms: latency.deep_avg_ms, cls: "bg-violet-500" },
              { label: "DeltaZero router (blended)", ms: latency.routed_avg_ms, cls: "bg-indigo-600" },
              { label: "Baseline: all Super + thinking", ms: latency.all_deep_avg_ms, cls: "bg-slate-400" },
            ].map((b) => (
              <div key={b.label}>
                <div className="flex justify-between text-xs text-slate-600">
                  <span>{b.label}</span>
                  <span className="font-semibold tabular-nums">{(b.ms / 1000).toFixed(2)}s / check</span>
                </div>
                <div className="mt-1 h-3 rounded-full bg-slate-100">
                  <div className={`h-3 rounded-full ${b.cls}`} style={{ width: `${(b.ms / maxLat) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-400">Last run {new Date(data.run_at).toLocaleString()}</p>
    </div>
  );
}
