"use client";

// Placeholder for Nimalan's Ticket Sharpener page.
// The Coverage Map's "Draft ticket" button links here with ?req=REQ-009&text=...

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function SharpenerInner() {
  const params = useSearchParams();
  const req = params.get("req");
  const text = params.get("text") ?? "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Ticket Sharpener</h1>
        <p className="mt-1 text-sm text-slate-500">Paste a ticket. DeltaZero scores its precision, checks the codebase, and rewrites it.</p>
      </div>
      {req && (
        <p className="rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-900">
          Drafting a ticket for <span className="font-mono font-semibold">{req}</span>, which was never ticketed.
        </p>
      )}
      <textarea
        defaultValue={text}
        rows={8}
        placeholder="e.g. Make cancellations work and handle errors."
        className="w-full rounded-xl border border-slate-300 bg-white p-4 text-sm shadow-sm"
      />
      <p className="text-xs text-slate-400">Nimalan: wire this page to POST /sharpen.</p>
    </div>
  );
}

export default function SharpenerPage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
      <SharpenerInner />
    </Suspense>
  );
}
