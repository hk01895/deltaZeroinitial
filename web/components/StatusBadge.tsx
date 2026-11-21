import type { CoverageStatus, Verdict } from "@/lib/types";

type Status = Verdict | CoverageStatus;

const STYLES: Record<Status, { label: string; icon: string; cls: string }> = {
  met: { label: "Met", icon: "✓", cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20" },
  partial: { label: "Partial", icon: "◐", cls: "bg-amber-50 text-amber-800 ring-amber-600/20" },
  missing: { label: "Missing", icon: "✕", cls: "bg-rose-50 text-rose-700 ring-rose-600/20" },
  needs_human: { label: "Needs human", icon: "👤", cls: "bg-sky-50 text-sky-700 ring-sky-600/20" },
  never_ticketed: { label: "Never ticketed", icon: "⚠", cls: "bg-orange-100 text-orange-800 ring-orange-600/30" },
  not_started: { label: "Not started", icon: "○", cls: "bg-slate-100 text-slate-600 ring-slate-500/20" },
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
