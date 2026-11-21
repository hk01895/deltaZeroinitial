"use client";

import { useSector } from "./SectorProvider";
import type { Sector } from "@/lib/types";

const OPTIONS: { value: Sector; label: string }[] = [
  { value: "general", label: "General software" },
  { value: "medical", label: "Medical" },
  { value: "finance", label: "Finance" },
];

export default function SectorSelect() {
  const { sector, setSector } = useSector();
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">Rule pack</span>
      <select
        value={sector}
        onChange={(e) => setSector(e.target.value as Sector)}
        className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm font-medium shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
