import Link from "next/link";
import SectorSelect from "./SectorSelect";

// Minimal top bar, no sidebar. The overview page is the hub; everything else
// is one click away from its cards.
export default function AppShell({ children, mock }: { children: React.ReactNode; mock: boolean }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-navy-700/40 bg-navy-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/40 bg-cyan-400/10 text-sm font-bold text-cyan-200 shadow-[0_0_18px_-6px_rgba(103,232,249,0.7)] transition group-hover:shadow-[0_0_22px_-4px_rgba(103,232,249,0.8)]">
              Δ0
            </span>
            <span className="text-base font-semibold tracking-tight text-slate-100">DeltaZero</span>
            <span className="ml-2 hidden text-xs text-slate-500 md:inline">CareSlot · powered by NVIDIA Nemotron</span>
            {mock && (
              <span className="ml-1 rounded-full border border-amber-300/20 bg-amber-300/10 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                mock data
              </span>
            )}
          </Link>
          <SectorSelect />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

export function BackLink() {
  return (
    <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-cyan-200">
      <span className="font-semibold text-cyan-300/80">Δ</span> ← Overview
    </Link>
  );
}
