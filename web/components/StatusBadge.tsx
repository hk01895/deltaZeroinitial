import type { CoverageStatus, Verdict } from "@/lib/types";

type Status = Verdict | CoverageStatus;

const STYLES: Record<Status, { label: string; icon: string; cls: string }> = {
  met: { label: "Met", icon: "✓", cls: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25" },
  partial: { label: "Partial", icon: "◐", cls: "bg-amber-400/10 text-amber-200 ring-amber-400/25" },
  missing: { label: "Missing", icon: "✕", cls: "bg-rose-400/10 text-rose-300 ring-rose-400/25" },
  needs_human: { label: "Needs human", icon: "👤", cls: "bg-sky-400/10 text-sky-300 ring-sky-400/25" },
  never_ticketed: { label: "Never ticketed", icon: "⚠", cls: "bg-orange-400/15 text-orange-300 ring-orange-400/35" },
  not_started: { label: "Not started", icon: "○", cls: "bg-slate-400/10 text-slate-300 ring-slate-400/20" },
};

export default function StatusBadge({ status }: { status: Status }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${s.cls}`}>
      <span aria-hidden>{s.icon}</span>
      {s.label}
    </span>
  );
}

export const STATUS_LABEL: Record<Status, string> = Object.fromEntries(
  Object.entries(STYLES).map(([k, v]) => [k, v.label]),
) as Record<Status, string>;

// Solid colors for bars and segments
export const STATUS_BAR: Record<Status, string> = {
  met: "bg-emerald-400",
  partial: "bg-amber-300",
  missing: "bg-rose-400",
  needs_human: "bg-sky-400",
  never_ticketed: "bg-orange-400",
  not_started: "bg-slate-500",
};
