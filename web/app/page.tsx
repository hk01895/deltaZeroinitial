"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { finishDemoSprint, getCoverage, getEval, getPRs, USING_MOCK } from "@/lib/api";
import type { Coverage, CoverageRow, CoverageStatus, EvalResult, PRSummary } from "@/lib/types";
import { useSector } from "@/components/SectorProvider";
import { STATUS_BAR, STATUS_LABEL } from "@/components/StatusBadge";
import CountUp from "@/components/CountUp";
import RequirementMap from "@/components/RequirementMap";
import Celebration from "@/components/Celebration";
import { card, eyebrow, link } from "@/lib/ui";

const BAR_ORDER: CoverageStatus[] = ["met", "partial", "missing", "not_started", "never_ticketed"];



// Celebrate the first time we see Δ 0 in this session (click the Δ to replay).
let celebratedThisSession = false;

const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

function tileHref(r: CoverageRow) {
  if (r.status === "never_ticketed") return `/sharpener?req=${encodeURIComponent(r.req_id)}&text=${encodeURIComponent(r.text)}`;
  if (r.pr_id) return `/pr/${r.pr_id}`;
  return null;
}

export default function Overview() {
  const { sector } = useSector();
  const [cov, setCov] = useState<Coverage | null>(null);
  const [prs, setPrs] = useState<PRSummary[] | null>(null);
  const [ev, setEv] = useState<EvalResult | null>(null);

  const [burst, setBurst] = useState(0);
  const prevDelta = useRef<number | null>(null);

  const load = useCallback(() => {
    getCoverage(sector).then(setCov);
    getPRs().then(setPrs);
  }, [sector]);

  useEffect(() => {
    load();
    getEval().then(setEv);
    window.addEventListener("dz:refresh", load);
    return () => window.removeEventListener("dz:refresh", load);
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<CoverageStatus, number> = { met: 0, partial: 0, missing: 0, never_ticketed: 0, not_started: 0 };
    cov?.requirements.forEach((r) => c[r.status]++);
    return c;
  }, [cov]);

  const deltaNow = cov ? cov.requirements.length - counts.met : null;

  // Fire the celebration when the Δ lands on 0 (after the count-down animation).
  useEffect(() => {
    if (deltaNow === null) return;
    const prev = prevDelta.current;
    prevDelta.current = deltaNow;
    if (deltaNow !== 0) return;
    if (prev !== null && prev !== 0) {
      const t = setTimeout(() => setBurst((b) => b + 1), 850);
      celebratedThisSession = true;
      return () => clearTimeout(t);
    }
    if (prev === null && !celebratedThisSession) {
      celebratedThisSession = true;
      const t = setTimeout(() => setBurst((b) => b + 1), 250);
      return () => clearTimeout(t);
    }
  }, [deltaNow]);

  if (!cov) return <p className="py-24 text-center text-sm text-slate-400">Measuring the delta…</p>;

  const total = cov.requirements.length;
  const delta = total - counts.met;
  const zero = delta === 0;
  const lost = cov.requirements.filter((r) => r.status === "never_ticketed");
  const drifted = cov.requirements.filter((r) => r.drift);
  const speedup = ev && ev.latency.routed_avg_ms ? ev.latency.all_deep_avg_ms / ev.latency.routed_avg_ms : 0;

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* ---------- Δ meter hero ---------- */}
      <Celebration fire={burst} />
      <section className="relative flex flex-col items-center pt-2 text-center sm:pt-6">
        <div
          className={`pointer-events-none absolute top-6 h-44 w-full max-w-[36rem] rounded-full blur-3xl sm:h-56 ${
            zero ? "bg-emerald-400/10" : "bg-cyan-400/[0.07]"
          }`}
        />
        <p className={`${eyebrow} relative`}>
          The delta · <span className="font-mono normal-case tracking-normal text-slate-500">{cov.spec_name}</span>
        </p>
        <h1
          data-tour="delta"
          onClick={() => zero && setBurst((b) => b + 1)}
          title={zero ? "Celebrate again" : undefined}
          className={`relative mt-2 flex items-baseline gap-3 font-semibold leading-none tabular-nums tracking-tight sm:gap-4 ${zero ? "cursor-pointer" : ""} ${
            zero
              ? "text-emerald-200 [text-shadow:0_0_40px_rgba(52,211,153,0.45)]"
              : "text-cyan-50 [text-shadow:0_0_40px_rgba(103,232,249,0.35)]"
          }`}
        >
          {zero && (
            <>
              <span key={`r1-${burst}`} className="dz-ring pointer-events-none absolute left-1/2 top-1/2 -ml-28 -mt-28 h-56 w-56 rounded-full border border-emerald-300/40" />
              <span key={`r2-${burst}`} className="dz-ring dz-ring-delay pointer-events-none absolute left-1/2 top-1/2 -ml-28 -mt-28 h-56 w-56 rounded-full border border-cyan-300/30" />
            </>
          )}
          <span className={`text-5xl sm:text-6xl md:text-7xl ${zero ? "text-emerald-300/80" : "text-cyan-300/70"}`}>Δ</span>
          <span className="text-[6.5rem] sm:text-[8rem] md:text-[10rem]">
            <CountUp value={delta} />
          </span>
        </h1>
        <p className="relative mt-3 px-2 text-sm text-slate-400 sm:text-base">
          {zero ? (
            <span
              key={`msg-${burst}`}
              className="dz-pop inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-1.5 font-medium text-emerald-200 shadow-[0_0_24px_-8px_rgba(52,211,153,0.7)]"
            >
              ✦ Zero delta. Everything you promised, shipped.
            </span>
          ) : (
            <>
              promised <span className="font-semibold text-slate-100">{total}</span> · shipped{" "}
              <span className="font-semibold text-slate-100">{counts.met}</span> ·{" "}
              <span className="text-cyan-200">{delta} to go</span>
            </>
          )}
        </p>

        <div className="relative mt-6 w-full max-w-2xl" data-tour="bar">
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-navy-800">
            {BAR_ORDER.map((s) => {
              const w = total ? (counts[s] / total) * 100 : 0;
              return w > 0 ? (
                <div key={s} className={`${STATUS_BAR[s]} opacity-90 transition-all duration-700`} style={{ width: `${w}%` }} />
              ) : null;
            })}
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-400 sm:gap-x-5">
            {BAR_ORDER.filter((s) => counts[s] > 0).map((s) => (
              <span key={s} className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${STATUS_BAR[s]}`} />
                <span className="font-semibold tabular-nums text-slate-200">{counts[s]}</span> {STATUS_LABEL[s].toLowerCase()}
              </span>
            ))}
          </div>
          {USING_MOCK && !zero && (
            <button
              data-tour="sprint"
              onClick={() => {
                finishDemoSprint();
                load();
              }}
              className="mt-4 text-[11px] text-slate-500 underline decoration-dotted underline-offset-4 transition hover:text-cyan-200"
            >
              Demo: simulate next sprint shipping the rest →
            </button>
          )}
        </div>
      </section>

      {/* ---------- Bento ---------- */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 [&>*]:min-w-0">
        {/* Lost requirements */}
        <div data-tour="lost" className={`${card} relative overflow-hidden p-5 ${lost.length ? "border-orange-400/30" : ""}`}>
          {lost.length > 0 && <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-orange-400/10 blur-2xl" />}
          <p className={eyebrow}>Lost requirements</p>
          <p className={`mt-1 text-4xl font-semibold tabular-nums ${lost.length ? "text-orange-200" : "text-emerald-300"}`}>
            {lost.length}
          </p>
          <p className="text-xs text-slate-400">{lost.length ? "in the spec, but never became a ticket" : "every requirement is ticketed"}</p>
          <ul className="mt-4 space-y-2">
            {lost.map((r) => (
              <li key={r.req_id} className="flex items-start justify-between gap-3 rounded-lg border border-orange-400/20 bg-navy-950/50 p-2.5">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] text-orange-300/90">{r.req_id}</p>
                  <p className="truncate text-sm text-slate-200">{r.text}</p>
                </div>
                <Link
                  href={tileHref(r) ?? "#"}
                  className="shrink-0 rounded-md border border-orange-300/40 bg-orange-400/10 px-2 py-1 text-xs font-medium text-orange-200 hover:bg-orange-400/20"
                >
                  Draft
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Pull requests */}
        <div data-tour="prs" className={`${card} p-5`}>
          <div className="flex items-baseline justify-between">
            <p className={eyebrow}>Pull requests</p>
            <Link href="/pr" className={`text-xs ${link}`}>
              all →
            </Link>
          </div>
          <ul className="mt-3 space-y-1">
            {(prs ?? []).map((p) => {
              const done = p.met === p.total;
              return (
                <li key={p.pr_id}>
                  <Link href={`/pr/${p.pr_id}`} className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-navy-850">
                    <span className="font-mono text-xs text-slate-500">#{p.pr_id}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-200 group-hover:text-cyan-100">{p.title}</span>
                    <span className="h-1 w-12 overflow-hidden rounded-full bg-navy-800">
                      <span
                        className={`block h-full ${done ? "bg-emerald-400" : "bg-amber-300"}`}
                        style={{ width: `${p.total ? (p.met / p.total) * 100 : 0}%` }}
                      />
                    </span>
                    <span className={`w-9 text-right text-sm font-semibold tabular-nums ${done ? "text-emerald-300" : "text-amber-200"}`}>
                      {p.met}/{p.total}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Model quality */}
        <Link href="/eval" className={`${card} group block p-5 transition hover:border-cyan-300/30`}>
          <div className="flex items-baseline justify-between">
            <p className={eyebrow}>How much to trust it</p>
            <span className={`text-xs ${link}`}>eval →</span>
          </div>
          {ev ? (
            <>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { k: "Precision", v: pct(ev.precision), c: "text-cyan-100" },
                  { k: "Recall", v: pct(ev.recall), c: "text-emerald-300" },
                  { k: "False +", v: pct(ev.false_positive_rate), c: "text-rose-300" },
                ].map((m) => (
                  <div key={m.k}>
                    <p className={`text-xl font-semibold tabular-nums ${m.c}`}>{m.v}</p>
                    <p className="text-[11px] text-slate-500">{m.k}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-navy-700 bg-navy-950/50 p-3 text-xs text-slate-400">
                <span className="font-semibold text-cyan-200">{speedup.toFixed(1)}× faster</span> with the fast/deep router.{" "}
                {Math.round(ev.latency.fast_share * 100)}% of checks run on Nemotron Lightning; only hard ones go to Super with thinking on.
              </div>
              <p className="mt-3 text-[11px] text-slate-500">{ev.n_cases} labeled cases</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Loading…</p>
          )}
        </Link>
      </section>

      {drifted.length > 0 && (
        <section className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-4 py-3 text-sm">
          <span className="font-semibold text-amber-200">↯ Drift</span>
          {drifted.map((r) => (
            <span key={r.req_id} className="text-amber-100/90">
              <span className="font-mono text-amber-300/80">{r.req_id}</span> {r.drift}
            </span>
          ))}
        </section>
      )}

      {/* ---------- Requirement map ---------- */}
      <section aria-labelledby="req-map-title" data-tour="map">
        <div className="mb-5">
          <h2 id="req-map-title" className="text-lg font-semibold tracking-tight text-slate-50">
            Requirement map
          </h2>
          <p className="text-sm text-slate-300">Every promise in the spec, and where it got to: spec → ticket → pull request.</p>
        </div>
        <RequirementMap rows={cov.requirements} />
      </section>
    </div>
  );
}
