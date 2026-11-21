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
    <aside className="flex w-60 shrink-0 flex-col bg-slate-900 text-slate-300">
      <Link href="/coverage" className="flex items-center gap-2 px-5 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-sm font-bold text-white">
          Δ0
        </span>
        <span className="text-lg font-semibold text-white">DeltaZero</span>
      </Link>
      <nav className="mt-2 flex flex-col gap-1 px-3">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors " +
                (active ? "bg-slate-800 text-white" : "hover:bg-slate-800/60 hover:text-white")
              }
            >
              <span className="w-4 text-center text-slate-400">{item.icon}</span>
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
