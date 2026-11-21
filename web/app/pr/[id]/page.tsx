"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getPRReview, rerunPR } from "@/lib/api";
import type { Override, PRReview, Verdict } from "@/lib/types";
import { useSector } from "@/components/SectorProvider";
import VerdictCard from "@/components/VerdictCard";
import RulePackPanel from "@/components/RulePackPanel";
import { STATUS_BAR, STATUS_LABEL } from "@/components/StatusBadge";
import { BackLink } from "@/components/AppShell";
import { btnPrimary, card, eyebrow, glow, glowStrong, link } from "@/lib/ui";

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

  if (error) return <p className="text-sm text-rose-300">Could not load PR #{prId}: {error}</p>;
  if (!review) return <p className="text-sm text-slate-400">Loading PR #{prId}…</p>;

  const total = review.verdicts.length;
  const met = review.verdicts.filter((v) => v.verdict === "met").length;
  const done = met === total;
  const counts = Object.fromEntries(ORDER.map((s) => [s, review.verdicts.filter((v) => v.verdict === s).length])) as Record<Verdict, number>;
  const sorted = [...review.verdicts].sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict));
  const deepCount = review.verdicts.filter((v) => v.model === "super").length;

  return (
    <div className="space-y-6">
      <div className="text-sm">
        <BackLink />
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
            <span className="text-slate-500">#{review.pr_id}</span> {review.title}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
            <a href={review.url} target="_blank" rel="noreferrer" className={link}>
              View on GitHub ↗
            </a>
            <span>·</span>
            <a href={review.ticket_url} target="_blank" rel="noreferrer" className={`font-mono ${link}`}>
              {review.ticket_key}
            </a>
            <span>·</span>
            <span className="font-mono text-slate-400">{review.branch}</span>
            <span>·</span>
            <span className="font-mono text-slate-400">{review.head_sha.slice(0, 7)}</span>
          </div>
        </div>
        <button onClick={rerun} disabled={running} className={btnPrimary}>
          {running ? "Re-checking latest commit…" : "↻ Re-run check"}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {/* Score */}
          <div className={`${card} ${done ? `border-emerald-400/30 ${glowStrong}` : glow} p-5`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className={eyebrow}>Requirements met</p>
                <p
                  className={`mt-1 text-5xl font-semibold tabular-nums sm:text-6xl ${
                    done
                      ? "text-emerald-200 [text-shadow:0_0_26px_rgba(52,211,153,0.45)]"
                      : "text-cyan-100 [text-shadow:0_0_22px_rgba(103,232,249,0.35)]"
                  }`}
                >
                  {met}
                  <span className="text-3xl text-slate-500">/{total}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm sm:justify-end">
                {ORDER.filter((s) => counts[s] > 0).map((s) => (
                  <span key={s} className="text-slate-400">
                    <span className="font-semibold tabular-nums text-slate-200">{counts[s]}</span> {STATUS_LABEL[s].toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
            <div className="mt-5 flex h-2 gap-1">
              {sorted.map((v) => (
                <div key={v.req_id} className={`flex-1 rounded-full opacity-90 ${STATUS_BAR[v.verdict]}`} title={`${v.req_id}: ${STATUS_LABEL[v.verdict]}`} />
              ))}
            </div>
            {done && (
              <p className="mt-3 text-sm font-medium text-emerald-300">
                ✓ Every requirement on {review.ticket_key} is met. Ready to merge.
              </p>
            )}
          </div>

          {sorted.map((v) => (
            <VerdictCard key={v.req_id} v={v} prId={review.pr_id} onOverridden={applyOverride} />
          ))}
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          <RulePackPanel />
          <div className={`${card} p-4`}>
            <p className={eyebrow}>How this was checked</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>
                <span className="font-semibold text-cyan-200">{total - deepCount}</span> fast checks · Nemotron Lightning, thinking off
              </li>
              <li>
                <span className="font-semibold text-violet-200">{deepCount}</span> deep checks · Nemotron Super, thinking on
              </li>
              <li className="text-slate-400">Every verdict must quote code that exists in the diff (Evidence Guard).</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
