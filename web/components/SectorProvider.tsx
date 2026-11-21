"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Sector } from "@/lib/types";

interface SectorCtx {
  sector: Sector;
  setSector: (s: Sector) => void;
}

const Ctx = createContext<SectorCtx>({ sector: "medical", setSector: () => {} });

const KEY = "deltazero.sector";

export function SectorProvider({ children }: { children: React.ReactNode }) {
  const [sector, setSectorState] = useState<Sector>("medical");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY) as Sector | null;
      if (saved === "general" || saved === "medical" || saved === "finance") setSectorState(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const setSector = (s: Sector) => {
    setSectorState(s);
    try {
      window.localStorage.setItem(KEY, s);
    } catch {
      /* storage unavailable */
    }
  };

  return <Ctx.Provider value={{ sector, setSector }}>{children}</Ctx.Provider>;
}

export const useSector = () => useContext(Ctx);
