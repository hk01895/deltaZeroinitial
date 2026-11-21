"use client";

// Placeholder for Nimalan's Ticket Sharpener page.
// The Coverage Map's "Draft ticket" button links here with ?req=REQ-009&text=...

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { card } from "@/lib/ui";
import { BackLink } from "@/components/AppShell";

function SharpenerInner() {
  const params = useSearchParams();
  const req = params.get("req");
  const text = params.get("text") ?? "";

  return (
    <div className="space-y-6">
      <BackLink />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Ticket Sharpener</h1>
        <p className="mt-1 text-sm text-slate-400">Paste a ticket. DeltaZero scores its precision, checks the codebase, and rewrites it.</p>
      </div>
      {req && (
        <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-50">
          Drafting a ticket for <span className="font-mono font-semibold">{req}</span>, which was never ticketed.
        </p>
      )}
      <textarea
        data-tour="sharpener"
        defaultValue={text}
        rows={8}
        placeholder="e.g. Make cancellations work and handle errors."
        className={`${card} w-full p-4 text-sm text-slate-100 placeholder:text-slate-600 focus:border-cyan-300/50 focus:outline-none`}
      />
      <p className="text-xs text-slate-500">Nimalan: wire this page to POST /sharpen.</p>
    </div>
  );
}

export default function SharpenerPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Loading…</p>}>
      <SharpenerInner />
    </Suspense>
  );
}
