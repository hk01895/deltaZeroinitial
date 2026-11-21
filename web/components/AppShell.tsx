import Icon from "./Icon";
import Link from "next/link";
import Assistant from "./Assistant";

// Minimal top bar, no sidebar. The overview page is the hub; everything else
// is one click away from its cards.
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-navy-700/40 bg-navy-950/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="group flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/40 bg-cyan-400/10 text-sm font-bold text-cyan-200 transition group-">
              Δ0
            </span>
            <span className="hidden text-base font-semibold tracking-tight text-slate-100 min-[380px]:inline">DeltaZero</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/project/new"
              className="whitespace-nowrap rounded-md border border-cyan-300/40 bg-cyan-400/10 px-2.5 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-cyan-400/20 sm:text-sm"
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon name="plus" className="h-4 w-4" /> Load project
              </span>
            </Link>
            
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8">{children}</main>
      <Assistant />
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
