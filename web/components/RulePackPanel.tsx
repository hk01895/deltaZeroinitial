"use client";

import { useEffect, useState } from "react";
import { getRulePack } from "@/lib/api";
import type { RulePack } from "@/lib/types";
import { useSector } from "./SectorProvider";
import { card, eyebrow } from "@/lib/ui";

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
    <div className={`${card} p-4`}>
      <p className={eyebrow}>Active rule pack</p>
      <p className="mt-1 font-medium text-cyan-100">{pack.name}</p>
      <ul className="mt-3 space-y-2">
        {pack.rules.map((r) => (
          <li key={r.id} className="flex gap-2 text-sm text-slate-300">
            <span className="shrink-0 font-mono text-xs text-slate-500">{r.id}</span>
            <span>{r.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
