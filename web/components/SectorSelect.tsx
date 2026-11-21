"use client";

import { useSector } from "./SectorProvider";
import type { Sector } from "@/lib/types";
import { input } from "@/lib/ui";

const OPTIONS: { value: Sector; label: string }[] = [
  { value: "general", label: "General software" },
  { value: "medical", label: "Medical" },
  { value: "finance", label: "Finance" },
];

export default function SectorSelect() {
  const { sector, setSector } = useSector();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="hidden text-slate-400 sm:inline">Rule pack</span>
      <select value={sector} onChange={(e) => setSector(e.target.value as Sector)} className={`${input} font-medium`}>
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
