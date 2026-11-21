"use client";

import { createContext, useContext } from "react";
import type { Sector } from "@/lib/types";

// Rule packs are switched off in the UI: every check runs as "general" (no extra sector rules).
interface SectorCtx {
  sector: Sector;
  setSector: (s: Sector) => void;
}

const Ctx = createContext<SectorCtx>({ sector: "general", setSector: () => {} });

export function SectorProvider({ children }: { children: React.ReactNode }) {
  return <Ctx.Provider value={{ sector: "general", setSector: () => {} }}>{children}</Ctx.Provider>;
}

export const useSector = () => useContext(Ctx);
