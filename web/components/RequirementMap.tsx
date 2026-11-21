import Link from "next/link";
import type { CoverageRow, CoverageStatus } from "@/lib/types";
import StatusBadge from "./StatusBadge";

// Requirement map, grouped so problems come first.
// Accessibility: status is always spelled out in text (never color alone),
// the spec → ticket → PR trail is written as words, every tile is a real link
// with a descriptive label, and text keeps high contrast on the dark navy.

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const;
const ATTENTION_RANK: Partial<Record<CoverageStatus, number>> = { never_ticketed: 0, missing: 1, partial: 2 };

const EDGE: Record<CoverageStatus, string> = {
  never_ticketed: "before:bg-orange-400",
  missing: "before:bg-rose-400",
  partial: "before:bg-amber-300",
  not_started: "before:bg-slate-400",
  met: "before:bg-emerald-400",
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-navy-950";

function hrefFor(r: CoverageRow) {
  if (r.status === "never_ticketed") return `/sharpener?req=${encodeURIComponent(r.req_id)}&text=${encodeURIComponent(r.text)}`;
  if (r.pr_id) return `/pr/${r.pr_id}`;
  return null;
}

type StepState = "ok" | "bad" | "partial" | "pending";
interface Step {
  label: string;
  state: StepState;
  spoken: string;
}

function traceSteps(r: CoverageRow): Step[] {
  const ticket: Step = r.ticket_key
    ? { label: r.ticket_key, state: "ok", spoken: `ticket ${r.ticket_key} exists` }
    : { label: "No ticket", state: "bad", spoken: "no ticket was created" };

  let pr: Step;
  if (!r.ticket_key) pr = { label: "No PR", state: "pending", spoken: "no pull request" };
  else if (!r.pr_id) pr = { label: "No PR yet", state: "pending", spoken: "no pull request yet" };
  else if (r.status === "met") pr = { label: `PR #${r.pr_id}`, state: "ok", spoken: `pull request ${r.pr_id} meets it` };
  else if (r.status === "partial") pr = { label: `PR #${r.pr_id}`, state: "partial", spoken: `pull request ${r.pr_id} only partly meets it` };
  else pr = { label: `PR #${r.pr_id}`, state: "bad", spoken: `pull request ${r.pr_id} does not meet it` };

  return [{ label: "Spec", state: "ok", spoken: "in the spec" }, ticket, pr];
}

const STEP_STYLE: Record<StepState, { icon: string; cls: string }> = {
  ok: { icon: "✓", cls: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" },
  bad: { icon: "✕", cls: "border-rose-400/40 bg-rose-400/10 text-rose-200" },
  partial: { icon: "◐", cls: "border-amber-300/40 bg-amber-300/10 text-amber-100" },
  pending: { icon: "…", cls: "border-slate-500/40 bg-slate-500/10 text-slate-300" },
};

function Trace({ r }: { r: CoverageRow }) {
  const steps = traceSteps(r);
  return (
    <ol className="flex flex-wrap items-center gap-1.5 text-xs" aria-label={`Trace: ${steps.map((s) => s.spoken).join(", ")}`}>
      {steps.map((s, i) => (
        <li key={i} className="flex items-center gap-1.5" aria-hidden>
          {i > 0 && <span className="text-slate-500">→</span>}
          <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-medium ${STEP_STYLE[s.state].cls}`}>
            <span>{STEP_STYLE[s.state].icon}</span>
            <span className="font-mono">{s.label}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Tile({ r }: { r: CoverageRow }) {
  const href = hrefFor(r);
  const action = r.status === "never_ticketed" ? "Draft a ticket" : href ? "Open PR review" : null;
  const inner = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-xs font-semibold text-slate-300">{r.req_id}</span>
        <StatusBadge status={r.status} />
      </div>
      <p className="mt-2 text-[15px] leading-6 text-slate-50">{r.text}</p>
      {r.reason && (
        <p className="mt-2 text-sm leading-5 text-slate-300">
          <span className="font-semibold text-slate-100">Why: </span>
          {r.reason}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Trace r={r} />
        {action && <span className="text-xs font-medium text-cyan-200">{action} →</span>}
      </div>
    </>
  );
  const cls = `relative block overflow-hidden rounded-xl border border-navy-700/80 bg-navy-900/80 p-4 pl-5 before:absolute before:inset-y-0 before:left-0 before:w-1 ${EDGE[r.status]}`;
  return href ? (
    <Link href={href} className={`${cls} transition hover:border-cyan-300/30 hover:bg-navy-850 ${focusRing}`} aria-label={`${r.req_id}: ${r.text}. ${action}`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

function Section({
  title,
  hint,
  count,
  tone,
  children,
}: {
  title: string;
  hint: string;
  count: number;
  tone: string;
  children: React.ReactNode;
}) {
  const id = `req-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 id={id} className={`text-base font-semibold ${tone}`}>
          {title} <span className="tabular-nums">({count})</span>
        </h3>
        <p className="text-sm text-slate-300">{hint}</p>
      </div>
      {children}
    </section>
  );
}

export default function RequirementMap({ rows }: { rows: CoverageRow[] }) {
  const byPriority = (a: CoverageRow, b: CoverageRow) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  const attention = rows
    .filter((r) => r.status in ATTENTION_RANK)
    .sort((a, b) => (ATTENTION_RANK[a.status]! - ATTENTION_RANK[b.status]!) || byPriority(a, b));
  const notStarted = rows.filter((r) => r.status === "not_started").sort(byPriority);
  const done = rows.filter((r) => r.status === "met");

  return (
    <div className="space-y-8">
      {attention.length > 0 && (
        <Section title="Needs attention" hint="Promised, but not delivered. Most urgent first." count={attention.length} tone="text-rose-200">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {attention.map((r) => (
              <Tile key={r.req_id} r={r} />
            ))}
          </div>
        </Section>
      )}

      {notStarted.length > 0 && (
        <Section title="Not started" hint="Ticketed, but no code yet." count={notStarted.length} tone="text-slate-100">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {notStarted.map((r) => (
              <Tile key={r.req_id} r={r} />
            ))}
          </div>
        </Section>
      )}

      {done.length > 0 && (
        <Section title="Done" hint="Verified in code." count={done.length} tone="text-emerald-200">
          <ul className="divide-y divide-navy-700/70 overflow-hidden rounded-xl border border-navy-700/70 bg-navy-900/50">
            {done.map((r) => {
              const href = hrefFor(r);
              const body = (
                <>
                  <span aria-hidden className="mt-0.5 text-emerald-300">✓</span>
                  <span className="w-16 shrink-0 font-mono text-xs font-semibold leading-6 text-slate-300">{r.req_id}</span>
                  <span className="min-w-0 flex-1 text-sm leading-6 text-slate-200">{r.text}</span>
                  <span className="shrink-0 font-mono text-xs leading-6 text-slate-300">
                    {r.ticket_key}
                    {r.pr_id ? ` · PR #${r.pr_id}` : ""}
                  </span>
                </>
              );
              return (
                <li key={r.req_id}>
                  {href ? (
                    <Link
                      href={href}
                      aria-label={`${r.req_id}: ${r.text}. Met. Open PR review.`}
                      className={`flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-2.5 transition hover:bg-navy-850 sm:flex-nowrap ${focusRing}`}
                    >
                      {body}
                    </Link>
                  ) : (
                    <div className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-2.5 sm:flex-nowrap">{body}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}
