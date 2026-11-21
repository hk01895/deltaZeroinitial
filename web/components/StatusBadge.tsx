import type { CoverageStatus, Verdict } from "@/lib/types";

// Kept deliberately small: THREE statuses per view, THREE colors total.
//
//   Project view (coverage):  ✓ Done (green) · ◐ In progress (amber) · ✕ Lost (red)
//   PR check (verdicts):      ✓ Met (green)  · ✕ Not met (red)       · ? Check needed (amber)
//
// The backend can still send detailed statuses (partial / missing / not_started);
// they are grouped here and the plain-English "Why" line carries the detail.

export type Status = Verdict | CoverageStatus;
export type Kind = "coverage" | "verdict";
export type Tone = "good" | "wait" | "bad";

export interface Look {
  label: string;
  icon: string;
  hint: string;
  tone: Tone;
}

const COVERAGE: Record<CoverageStatus, Look> = {
  met: { label: "Done", icon: "✓", hint: "Verified in code", tone: "good" },
  partial: { label: "In progress", icon: "◐", hint: "Has a ticket, not finished yet", tone: "wait" },
  missing: { label: "In progress", icon: "◐", hint: "Has a ticket, not finished yet", tone: "wait" },
  not_started: { label: "In progress", icon: "◐", hint: "Has a ticket, not finished yet", tone: "wait" },
  never_ticketed: { label: "Lost", icon: "✕", hint: "In the spec, but no ticket was ever made", tone: "bad" },
};

const VERDICT: Record<Verdict, Look> = {
  met: { label: "Met", icon: "✓", hint: "The code does what was promised", tone: "good" },
  partial: { label: "Not met", icon: "✕", hint: "The code doesn't fully do this yet", tone: "bad" },
  missing: { label: "Not met", icon: "✕", hint: "The code doesn't fully do this yet", tone: "bad" },
  needs_human: { label: "Check needed", icon: "?", hint: "The AI isn't sure, so a person should look", tone: "wait" },
};

export function look(status: Status, kind: Kind): Look {
  return kind === "coverage" ? COVERAGE[status as CoverageStatus] ?? VERDICT[status as Verdict] : VERDICT[status as Verdict] ?? COVERAGE[status as CoverageStatus];
}

export const TONE: Record<Tone, { badge: string; bar: string; edge: string; text: string; dot: string }> = {
  good: {
    badge: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30",
    bar: "bg-emerald-400",
    edge: "before:bg-emerald-400",
    text: "text-emerald-300",
    dot: "bg-emerald-400",
  },
  wait: {
    badge: "bg-amber-300/10 text-amber-100 ring-amber-300/30",
    bar: "bg-amber-300",
    edge: "before:bg-amber-300",
    text: "text-amber-200",
    dot: "bg-amber-300",
  },
  bad: {
    badge: "bg-rose-400/10 text-rose-200 ring-rose-400/35",
    bar: "bg-rose-400",
    edge: "before:bg-rose-400",
    text: "text-rose-300",
    dot: "bg-rose-400",
  },
};

/** Verdict labels (PR view): Met / Not met / Check needed. */
export const STATUS_LABEL: Record<Verdict, string> = {
  met: VERDICT.met.label,
  partial: VERDICT.partial.label,
  missing: VERDICT.missing.label,
  needs_human: VERDICT.needs_human.label,
};

/** Bar color for a verdict (PR view). */
export const STATUS_BAR: Record<Verdict, string> = {
  met: TONE.good.bar,
  partial: TONE.bad.bar,
  missing: TONE.bad.bar,
  needs_human: TONE.wait.bar,
};

export default function StatusBadge({ status, kind = "verdict" }: { status: Status; kind?: Kind }) {
  const l = look(status, kind);
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TONE[l.tone].badge}`}
      title={l.hint}
    >
      <span aria-hidden className="font-bold">
        {l.icon}
      </span>
      {l.label}
    </span>
  );
}

// ---- Project-view grouping (home page) ------------------------------------

export type Group = "done" | "progress" | "lost";
export const GROUP_OF: Record<CoverageStatus, Group> = {
  met: "done",
  partial: "progress",
  missing: "progress",
  not_started: "progress",
  never_ticketed: "lost",
};
export const GROUP: Record<Group, { label: string; tone: Tone }> = {
  done: { label: "Done", tone: "good" },
  progress: { label: "In progress", tone: "wait" },
  lost: { label: "Lost", tone: "bad" },
};
export const GROUP_ORDER: Group[] = ["done", "progress", "lost"];

export function groupCounts(statuses: CoverageStatus[]): Record<Group, number> {
  const c: Record<Group, number> = { done: 0, progress: 0, lost: 0 };
  statuses.forEach((s) => c[GROUP_OF[s]]++);
  return c;
}

export function ColorKey({ counts, className = "" }: { counts: Record<Group, number>; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-slate-300 ${className}`}>
      {GROUP_ORDER.map((g) => (
        <span key={g} className="flex items-center gap-1.5">
          <span className={`h-2 w-2 rounded-full ${TONE[GROUP[g].tone].dot}`} aria-hidden />
          <span className="font-semibold tabular-nums text-slate-100">{counts[g]}</span>
          <span>{GROUP[g].label.toLowerCase()}</span>
        </span>
      ))}
    </div>
  );
}
