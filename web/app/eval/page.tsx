"use client";

import { useEffect, useState } from "react";
import { getEval } from "@/lib/api";
import type { EvalResult } from "@/lib/types";
import StatCard from "@/components/StatCard";
import { STATUS_LABEL } from "@/components/StatusBadge";
import type { Verdict } from "@/lib/types";
import { card } from "@/lib/ui";
import { BackLink } from "@/components/AppShell";

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

export default function EvalPage() {
  const [data, setData] = useState<EvalResult | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    getEval()
      .then(setData)
      .catch(() => setMissing(true));
  }, []);

  if (missing)
    return (
      <div className="space-y-6">
        <BackLink />
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Eval</h1>
        <div className={`${card} p-5 text-sm leading-6 text-slate-300`}>
          <p className="font-medium text-slate-100">No eval results yet.</p>
          <p className="mt-1">Build 30 labeled cases from real GitHub projects and score the verifier:</p>
          <pre className="mt-3 overflow-x-auto rounded-lg border border-navy-700 bg-navy-950 p-3 font-mono text-xs text-slate-200">
            {"python3 eval/build_cases.py --n 10\npython3 eval/run_eval.py --api http://localhost:8000/ui"}
          </pre>
        </div>
      </div>
    );
  if (!data) return <p className="text-sm text-slate-400">Loading eval…</p>;

  // Show the same 3 verdicts as the rest of the app (partial + missing = "Not met").
  const groups = Array.from(new Set(data.labels.map((l) => STATUS_LABEL[l as Verdict])));
  const gi = (l: Verdict) => groups.indexOf(STATUS_LABEL[l]);
  const matrix = groups.map(() => groups.map(() => 0));
  data.confusion.forEach((row, i) => row.forEach((n, j) => (matrix[gi(data.labels[i])][gi(data.labels[j])] += n)));
  const maxCell = Math.max(1, ...matrix.flat());
  const { latency } = data;
  const maxLat = Math.max(latency.all_deep_avg_ms, latency.routed_avg_ms, latency.fast_avg_ms, 1);
  const speedup = latency.routed_avg_ms ? latency.all_deep_avg_ms / latency.routed_avg_ms : 0;

  return (
    <div className="space-y-6">
      <BackLink />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Eval</h1>
        <p className="mt-1 text-sm text-slate-400">
          {data.n_cases} labeled requirement/PR cases. A &ldquo;positive&rdquo; is a real gap (partial or missing).
        </p>
      </div>

      <div data-tour="eval" className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Precision" value={pct(data.precision)} sub="When we flag a gap, how often it's real" tone="cyan" />
        <StatCard label="Recall" value={pct(data.recall)} sub="Share of real gaps we catch" tone="emerald" />
        <StatCard label="False-positive rate" value={pct(data.false_positive_rate)} sub="Done work wrongly flagged as a gap" tone="rose" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Confusion matrix */}
        <div className={`${card} min-w-0 p-4 sm:p-5`}>
          <p className="text-sm font-semibold text-slate-100">Confusion matrix</p>
          <p className="text-xs text-slate-400">Rows = actual · columns = DeltaZero&rsquo;s verdict</p>
          <div className="mt-4 overflow-x-auto">
            <table className="text-sm">
              <thead>
                <tr>
                  <th />
                  {groups.map((l) => (
                    <th key={l} className="px-1 pb-2 text-[10px] font-medium leading-tight text-slate-300 sm:px-2 sm:text-xs">
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, i) => (
                  <tr key={i}>
                    <th className="pr-2 text-right text-[10px] font-medium leading-tight text-slate-300 sm:pr-3 sm:text-xs">{groups[i]}</th>
                    {row.map((n, j) => {
                      const diag = i === j;
                      const alpha = n / maxCell;
                      return (
                        <td key={j} className="p-1">
                          <div
                            className="flex h-10 w-12 items-center justify-center rounded-md border font-semibold tabular-nums text-slate-100 sm:h-12 sm:w-20"
                            style={{
                              backgroundColor: diag
                                ? `rgba(52, 211, 153, ${0.06 + alpha * 0.32})`
                                : `rgba(251, 113, 133, ${n ? 0.08 + alpha * 0.3 : 0.02})`,
                              borderColor: diag ? `rgba(52, 211, 153, ${0.15 + alpha * 0.35})` : `rgba(251, 113, 133, ${n ? 0.25 : 0.06})`,
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
        <div className={`${card} min-w-0 p-4 sm:p-5`}>
          <p className="text-sm font-semibold text-slate-100">Fast/deep thinking router</p>
          <p className="text-xs text-slate-400">
            {Math.round(latency.fast_share * 100)}% of checks resolved on the fast path ·{" "}
            <span className="text-cyan-200">{speedup.toFixed(1)}× faster</span> than running everything on Super with thinking on
          </p>
          <div className="mt-5 space-y-4">
            {[
              { label: "Lightning · thinking off", ms: latency.fast_avg_ms, cls: "bg-cyan-300/80" },
              { label: "Super · thinking on", ms: latency.deep_avg_ms, cls: "bg-violet-400/80" },
              { label: "DeltaZero router (blended)", ms: latency.routed_avg_ms, cls: "bg-cyan-300" },
              { label: "Baseline: all Super + thinking", ms: latency.all_deep_avg_ms, cls: "bg-slate-500/70" },
            ].map((b) => (
              <div key={b.label}>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{b.label}</span>
                  <span className="font-semibold tabular-nums text-slate-200">{(b.ms / 1000).toFixed(2)}s / check</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-navy-800">
                  <div className={`h-2 rounded-full ${b.cls}`} style={{ width: `${(b.ms / maxLat) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-xs text-slate-500">Last run {new Date(data.run_at).toLocaleString()}</p>
    </div>
  );
}
