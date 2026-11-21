"use client";

// Ticket Sharpener (Nimalan's backend: POST /ui/sharpen → ticket_sharpener/sharpener.py)
// The Coverage Map's "Create ticket" links here with ?req=REQ-009&text=...

import Icon from "@/components/Icon";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { sharpen, type SharpenResult } from "@/lib/api";
import { useSector } from "@/components/SectorProvider";
import { BackLink } from "@/components/AppShell";
import { btnPrimary, card, eyebrow } from "@/lib/ui";

const GRADE: Record<string, string> = {
  precise: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  "needs work": "border-amber-300/30 bg-amber-300/10 text-amber-100",
  vague: "border-rose-400/30 bg-rose-400/10 text-rose-200",
};

function SharpenerInner() {
  const params = useSearchParams();
  const { sector } = useSector();
  const req = params.get("req");
  const [text, setText] = useState(params.get("text") ?? "");
  const [res, setRes] = useState<SharpenResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setRes(await sharpen(text, sector));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sharpen the ticket");
    } finally {
      setBusy(false);
    }
  };

  const red = res?.redundancy;
  const redFound = red && ["exists", "partial", "possible"].includes(red.status);

  return (
    <div className="space-y-6">
      <BackLink />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">Ticket Sharpener</h1>
        <p className="mt-1 text-sm text-slate-300">
          Paste a ticket before it&rsquo;s published. DeltaZero scores how precise it is, checks whether the code already does it, and rewrites it.
        </p>
      </div>
      {req && (
        <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-50">
          Drafting a ticket for <span className="font-mono font-semibold">{req}</span>, which was never ticketed.
        </p>
      )}

      <form onSubmit={run} className="space-y-3">
        <label htmlFor="ticket" className="sr-only">
          Ticket text
        </label>
        <textarea
          id="ticket"
          data-tour="sharpener"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="e.g. Make cancellations work and handle errors."
          className={`${card} w-full p-4 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none`}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={busy || !text.trim()} className={btnPrimary}>
            {busy ? "Sharpening with Nemotron…" : "Sharpen ticket"}
          </button>
          <span className="text-xs text-slate-400">Rule pack: {sector}</span>
        </div>
      </form>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      {res && (
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className={`${card} p-5 text-center`}>
              <p className={eyebrow}>Precision</p>
              <p className="mt-1 font-display text-6xl font-semibold tabular-nums text-cyan-50 [text-shadow:0_0_22px_rgba(103,232,249,0.35)]">{res.score}</p>
              <span className={`mt-2 inline-block rounded-full border px-3 py-0.5 text-sm font-medium ${GRADE[res.grade] ?? GRADE["needs work"]}`}>{res.grade}</span>
              {res.fallback && <p className="mt-3 text-xs text-amber-200">{res.note ?? "AI unavailable: rule-based checks only."}</p>}
            </div>
            {red && (
              <div className={`${card} p-4 text-sm ${redFound ? "border-amber-300/40" : ""}`}>
                <p className={eyebrow}>Already in the code?</p>
                {redFound ? (
                  <p className="mt-2 leading-6 text-amber-50">
                    <Icon name="alert" className="mr-1.5 h-4 w-4 align-[-3px] text-amber-300" />
                    {red.explanation ?? `Similar code found${red.file ? ` in ${red.file}` : ""}. Check before building it again.`}
                  </p>
                ) : (
                  <p className="mt-2 text-slate-300">{red.status === "unknown" ? red.explanation ?? "No repo indexed." : "Nothing similar found. This is new work."}</p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {res.issues.length > 0 && (
              <div className={`${card} p-5`}>
                <p className={eyebrow}>What&rsquo;s unclear ({res.issues.length})</p>
                <ul className="mt-3 space-y-3">
                  {res.issues.map((i, k) => (
                    <li key={k} className="text-sm leading-6">
                      <span className="rounded bg-rose-400/10 px-1.5 py-0.5 font-mono text-xs text-rose-200">{i.text}</span>{" "}
                      <span className="text-slate-200">{i.why}</span>
                      {i.fix && <p className="text-slate-400">→ {i.fix}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {res.rewrite && (
              <div className={`${card} p-5`}>
                <p className={eyebrow}>Sharpened ticket</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-100">{res.rewrite}</p>
                {res.acceptance_criteria.length > 0 && (
                  <>
                    <p className={`${eyebrow} mt-4`}>Acceptance criteria</p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-200">
                      {res.acceptance_criteria.map((a, k) => (
                        <li key={k}>{a}</li>
                      ))}
                    </ul>
                  </>
                )}
                <p className="mt-4 text-xs text-slate-400">[TBD: …] marks details the ticket didn&rsquo;t give. The AI never invents numbers.</p>
              </div>
            )}
          </div>
        </div>
      )}
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
