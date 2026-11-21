import { card, eyebrow } from "@/lib/ui";

export default function StatCard({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  sub?: string;
  tone?: "slate" | "emerald" | "amber" | "rose" | "orange" | "cyan";
}) {
  const toneCls: Record<string, string> = {
    slate: "text-slate-100",
    emerald: "text-emerald-300",
    amber: "text-amber-200",
    rose: "text-rose-300",
    orange: "text-orange-300",
    cyan: "text-cyan-200",
  };
  return (
    <div className={`${card} p-4`}>
      <p className={eyebrow}>{label}</p>
      <p className={`mt-1 font-display text-3xl font-semibold tabular-nums ${toneCls[tone]}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}
