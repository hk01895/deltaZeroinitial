"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getPRReview, rerunPR } from "@/lib/api";
import type { Override, PRReview, Verdict } from "@/lib/types";
import { useSector } from "@/components/SectorProvider";
import VerdictCard from "@/components/VerdictCard";
import RulePackPanel from "@/components/RulePackPanel";
import { STATUS_LABEL } from "@/components/StatusBadge";

const ORDER: Verdict[] = ["missing", "partial", "needs_human", "met"];

export default function PRReviewPage() {
  const params = useParams<{ id: string }>();
  const prId = Number(params.id);
  const { sector } = useSector();
  const [review, setReview] = useState<PRReview | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    getPRReview(prId, sector)
      .then(setReview)
      .catch((e) => setError(String(e)));
  }, [prId, sector]);

  useEffect(load, [load]);

  const rerun = async () => {
    setRunning(true);
    setError(null);
    try {
      setReview(await rerunPR(prId, sector));
    } catch (e) {
      setError(String(e));
    } finally {
      setRunning(false);
    }
  };

  const applyOverride = (o: Override) => {
    setReview((r) =>
      r
        ? {
            ...r,
            verdicts: r.verdicts.map((v) => (v.req_id === o.req_id ? { ...v, verdict: o.new_verdict, override: o } : v)),
          }
        : r,
    );
  };

  if (error) return <p className="text-sm text-rose-700">Could not load PR #{prId}: {error}</p>;
  if (!review) return <p className="text-sm text-slate-500">Loading PR #{prId}…</p>;

  const total = review.verdicts.length;
  const met = review.verdicts.filter((v) => v.verdict === "met").length;
  const done = met === total;
  const counts = Object.fromEntries(ORDER.map((s) => [s, review.verdicts.filter((v) => v.verdict === s).length])) as Record<Verdict, number>;
  const sorted = [...review.verdicts].sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict));
  const deepCount = review.verdicts.filter((v) => v.model === "super").length;

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <Link href="/pr" className="text-slate-500 hover:text-slate-800">
          ← PR Reviews
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            <span className="text-slate-400">#{review.pr_id}</span> {review.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
            <a href={review.url} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
              View on GitHub ↗
            </a>
            <span>·</span>
            <a href={review.ticket_url} target="_blank" rel="noreferrer" className="font-mono text-indigo-600 hover:underline">
              {review.ticket_key}
            </a>
            <span>·</span>
            <span className="font-mono">{review.branch}</span>
            <span>·</span>
            <span className="font-mono">{review.head_sha.slice(0, 7)}</span>
          </div>
        </div>
        <button
          onClick={rerun}
          disabled={running}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {running ? "Re-checking latest commit…" : "↻ Re-run check"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* Score */}
          <div className={`rounded-xl border p-5 shadow-sm ${done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-sm text-slate-500">Requirements met</p>
                <p className={`text-5xl font-semibold tabular-nums ${done ? "text-emerald-600" : "text-slate-900"}`}>
                  {met}
                  <span className="text-3xl text-slate-400">/{total}</span>
                </p>
              </div>
              <div className="flex flex-wrap justify-end gap-3 text-sm">
                {ORDER.filter((s) => counts[s] > 0).map((s) => (
                  <span key={s} className="text-slate-600">
                    <span className="font-semibold tabular-nums">{counts[s]}</span> {STATUS_LABEL[s].toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-4 flex h-2.5 gap-1">
              {sorted.map((v) => (
                <div
                  key={v.req_id}
                  className={`flex-1 rounded-full ${
                    { met: "bg-emerald-500", partial: "bg-amber-400", missing: "bg-rose-500", needs_human: "bg-sky-400" }[v.verdict]
                  }`}
                  title={`${v.req_id}: ${STATUS_LABEL[v.verdict]}`}
                />
              ))}
            </div>
            {done && <p className="mt-3 text-sm font-medium text-emerald-700">✓ Every requirement on {review.ticket_key} is met. Ready to merge.</p>}
          </div>

          {sorted.map((v) => (
            <VerdictCard key={v.req_id} v={v} prId={review.pr_id} onOverridden={applyOverride} />
          ))}
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <RulePackPanel />
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">How this was checked</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li>
                <span className="font-semibold">{total - deepCount}</span> fast checks · Nemotron Lightning, thinking off
              </li>
              <li>
                <span className="font-semibold">{deepCount}</span> deep checks · Nemotron Super, thinking on
              </li>
              <li>Every verdict must quote code that exists in the diff (Evidence Guard).</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
