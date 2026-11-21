"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/coverage", label: "Coverage Map", icon: "▦" },
  { href: "/pr", label: "PR Reviews", icon: "⇄" },
  { href: "/sharpener", label: "Ticket Sharpener", icon: "✎" },
  { href: "/eval", label: "Eval", icon: "◎" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-navy-700/60 bg-navy-950/80">
      <Link href="/coverage" className="flex items-center gap-2.5 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/40 bg-cyan-400/10 text-sm font-bold text-cyan-200 shadow-[0_0_18px_-6px_rgba(103,232,249,0.7)]">
          Δ0
        </span>
        <span className="text-lg font-semibold tracking-tight text-slate-100">DeltaZero</span>
      </Link>
      <nav className="mt-2 flex flex-col gap-1 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors " +
                (active
                  ? "bg-navy-800 text-cyan-100 shadow-[inset_2px_0_0_0_rgba(103,232,249,0.8),0_0_20px_-10px_rgba(103,232,249,0.5)]"
                  : "text-slate-400 hover:bg-navy-850 hover:text-slate-200")
              }
            >
              <span className={"w-4 text-center " + (active ? "text-cyan-300" : "text-slate-500")}>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-auto px-5 pb-5 text-xs leading-relaxed text-slate-500">
        No difference between what you promised and what you shipped.
      </p>
    </aside>
  );
}
