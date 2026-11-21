"use client";

import { useEffect, useState } from "react";
import { getRulePack } from "@/lib/api";
import type { RulePack } from "@/lib/types";
import { useSector } from "./SectorProvider";

export default function RulePackPanel() {
  const { sector } = useSector();
  const [pack, setPack] = useState<RulePack | null>(null);

  useEffect(() => {
    let alive = true;
    getRulePack(sector).then((p) => alive && setPack(p));
    return () => {
      alive = false;
    };
  }, [sector]);

  if (!pack) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active rule pack</p>
      <p className="mt-1 font-medium text-slate-900">{pack.name}</p>
      <ul className="mt-3 space-y-2">
        {pack.rules.map((r) => (
          <li key={r.id} className="flex gap-2 text-sm text-slate-700">
            <span className="shrink-0 font-mono text-xs text-slate-400">{r.id}</span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
