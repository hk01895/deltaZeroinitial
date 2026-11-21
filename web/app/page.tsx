"use client";

import Icon from "@/components/Icon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCoverage, getCurrentProject, getEval, getPRs } from "@/lib/api";
import type { ProjectStatus } from "@/lib/types";
import type { Coverage, CoverageRow, CoverageStatus, EvalResult, PRSummary } from "@/lib/types";
import { useSector } from "@/components/SectorProvider";
import { ColorKey, GROUP, GROUP_ORDER, TONE, groupCounts } from "@/components/StatusBadge";
import CreateTicketModal from "@/components/CreateTicketModal";
import PRLinkBox from "@/components/PRLinkBox";
import CountUp from "@/components/CountUp";
import RequirementMap from "@/components/RequirementMap";
import SuggestedTickets from "@/components/SuggestedTickets";
import Celebration from "@/components/Celebration";
import { btnPrimary, card, eyebrow, link } from "@/lib/ui";




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

  const [loadError, setLoadError] = useState<string | null>(null);
  const load = useCallback(() => {
    getCoverage(sector)
      .then((c) => {
        setCov(c);
        setLoadError(null);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : String(e)));
    getPRs()
      .then(setPrs)
      .catch(() => setPrs([]));
  }, [sector]);

  // While a freshly loaded project's PRs are being checked, refresh every few seconds.
  const [proj, setProj] = useState<ProjectStatus | null>(null);
  const [projChecked, setProjChecked] = useState(false);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const p = await getCurrentProject();
      if (!alive) return;
      setProj(p);
      setProjChecked(true);
      if (p && (p.status === "checking" || p.status === "loading")) {
        load();
        timer = setTimeout(tick, 3000);
      } else if (p) {
        load();
      }
    };
    tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [load]);

  useEffect(() => {
    load();
    getEval().then(setEv).catch(() => setEv(null));
    window.addEventListener("dz:refresh", load);
    return () => window.removeEventListener("dz:refresh", load);
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<CoverageStatus, number> = { met: 0, partial: 0, missing: 0, never_ticketed: 0, not_started: 0 };
    cov?.requirements.forEach((r) => c[r.status]++);
    return c;
  }, [cov]);

  const buckets = useMemo(() => groupCounts(cov?.requirements.map((r) => r.status) ?? []), [cov]);
  const [creating, setCreating] = useState<CoverageRow | null>(null);
  const [followUp, setFollowUp] = useState(false);
  const openCreate = (r: CoverageRow, asFollowUp = false) => {
    setFollowUp(asFollowUp);
    setCreating(r);
  };
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const deltaNow = cov ? cov.requirements.length - counts.met : null;

  // Nothing loaded yet: start on the "Load a project" page.
  const router = useRouter();
  const nothingLoaded = !!cov && cov.requirements.length === 0 && projChecked && !proj;
  useEffect(() => {
    if (nothingLoaded) router.replace("/project/new");
  }, [nothingLoaded, router]);

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

  if (!cov && loadError)
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Backend not running</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">{loadError}</p>
        <p className="mt-2 text-sm text-slate-400">Start it with <span className="font-mono text-slate-200">uvicorn main:app --port 8000</span> in the backend folder, then refresh.</p>
      </div>
    );
  if (!cov) return <p className="py-24 text-center text-sm text-slate-400">Measuring the delta…</p>;

  if (cov.requirements.length === 0)
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="font-display text-6xl font-semibold text-cyan-300/70">Δ</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-slate-50">No project loaded yet</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Point DeltaZero at a GitHub repo and its spec. It finds every promise, matches it to an issue, and checks the pull requests.
        </p>
        <Link href="/project/new" className={`${btnPrimary} mt-6 inline-block`}>
          Load a project
        </Link>
      </div>
    );

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
          {cov.project} · <span className="font-mono normal-case tracking-normal text-slate-500">{cov.spec_name}</span>
        </p>
        {proj && proj.status !== "ready" && proj.status !== "error" && (
          <p className="relative mt-2 text-xs text-cyan-200">
            Checking pull requests{proj.progress.total ? ` ${proj.progress.done ?? 0}/${proj.progress.total}` : ""}…
          </p>
        )}
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
              className="dz-pop inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-1.5 font-medium text-emerald-200"
            >
              <Icon name="sparkles" className="h-4 w-4" /> Zero delta. Everything you promised, shipped.
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
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-navy-800" role="img" aria-label={`${buckets.done} done, ${buckets.progress} in progress, ${buckets.lost} lost`}>
            {GROUP_ORDER.map((k) => {
              const w = total ? (buckets[k] / total) * 100 : 0;
              return w > 0 ? <div key={k} className={`${TONE[GROUP[k].tone].bar} opacity-90 transition-all duration-700`} style={{ width: `${w}%` }} /> : null;
            })}
          </div>
          <ColorKey counts={buckets} className="mt-3" />
        </div>
      </section>

      {/* ---------- Lost requirements: the hero ---------- */}
      <section
        data-tour="lost"
        aria-labelledby="lost-title"
        className={`relative overflow-hidden rounded-2xl border p-6 sm:p-8 ${
          lost.length ? "border-rose-400/35 bg-gradient-to-br from-rose-500/[0.08] via-navy-900/80 to-navy-900/80" : "border-emerald-400/25 bg-navy-900/70"
        }`}
      >
        <div className="grid gap-6 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-10">
          <div>
            <h2 id="lost-title" className="text-sm font-medium uppercase tracking-[0.14em] text-slate-300">
              Lost requirements
            </h2>
            <p className={`mt-2 font-display text-6xl font-semibold tabular-nums leading-none ${lost.length ? "text-rose-200" : "text-emerald-300"}`}>
              {lost.length}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {lost.length
                ? "Promised in the spec, but nobody ever made a ticket. Other tools can't see these."
                : "Every requirement has a ticket. Nothing is falling through the cracks."}
            </p>
          </div>
          {lost.length > 0 && (
            <ul className="space-y-2 self-center">
              {lost.map((r) => (
                <li key={r.req_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/20 bg-navy-950/60 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-rose-300/90">{r.req_id}</p>
                    <p className="text-[15px] leading-6 text-slate-100">{r.text}</p>
                  </div>
                  <button
                    data-tour="create-ticket"
                    onClick={() => openCreate(r)}
                    className="shrink-0 rounded-md border border-cyan-300/40 bg-cyan-400/10 px-3 py-1.5 text-sm font-medium text-cyan-100 hover:bg-cyan-400/20"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Icon name="plus" className="h-4 w-4" /> Create ticket
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* ---------- Secondary: PRs + trust, smaller and unequal ---------- */}
      <section className="-mt-4 grid grid-cols-1 gap-3 sm:-mt-6 md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] [&>*]:min-w-0">
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
          <div className="mt-3 border-t border-navy-700/70 pt-3">
            <PRLinkBox compact />
          </div>
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
            <p className="mt-3 text-sm text-slate-400">No eval run yet. Run eval/run_eval.py to see how accurate it is.</p>
          )}
        </Link>
      </section>

      {drifted.length > 0 && (
        <section className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] px-4 py-3 text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold text-amber-200"><Icon name="drift" className="h-4 w-4" /> Drift</span>
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
        <RequirementMap rows={cov.requirements} onCreateTicket={(r) => openCreate(r)} />
      </section>

      {/* ---------- Suggested tickets: last, not the main thing ---------- */}
      <SuggestedTickets rows={cov.requirements} onCreate={(r) => openCreate(r, true)} />

      {creating && (
        <CreateTicketModal
          row={creating}
          followUp={followUp}
          onClose={() => setCreating(null)}
          onCreated={(key) => {
            setToast(followUp ? `${key} created as a follow-up for ${creating.req_id}.` : `${key} created. ${creating.req_id} is no longer lost.`);
            setCreating(null);
            load();
          }}
        />
      )}
      {toast && (
        <div className="fixed inset-x-0 bottom-20 z-50 flex justify-center px-4">
          <div role="status" className="dz-pop rounded-full border border-emerald-300/30 bg-navy-900/95 px-4 py-2 text-sm text-emerald-100">
            <span className="inline-flex items-center gap-2"><Icon name="check" className="h-4 w-4" /> {toast}</span>
          </div>
        </div>
      )}
    </div>
  );
}
