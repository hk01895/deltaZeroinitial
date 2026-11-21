"use client";

import Icon from "@/components/Icon";
import { useEffect, useState } from "react";
import { regenerateFix } from "@/lib/api";
import type { Override, RequirementVerdict } from "@/lib/types";
import StatusBadge, { STATUS_LABEL, TONE } from "./StatusBadge";
import { DiffBlock, EvidenceBlock, PlainCode } from "./CodeBlock";
import OverrideForm from "./OverrideForm";
import { btnGhost, btnPrimary, card, eyebrow, input } from "@/lib/ui";

const ACCENT: Record<RequirementVerdict["verdict"], string> = {
  met: TONE.good.edge,
  partial: TONE.bad.edge,
  missing: TONE.bad.edge,
  needs_human: TONE.wait.edge,
};

export default function VerdictCard({
  v,
  prId,
  onOverridden,
}: {
  v: RequirementVerdict;
  prId: number;
  onOverridden: (o: Override) => void;
}) {
  const [showOverride, setShowOverride] = useState(false);
  const [fix, setFix] = useState({ diff: v.suggested_diff ?? null, test: v.suggested_test ?? null, note: null as string | null });
  const [asking, setAsking] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [regenBusy, setRegenBusy] = useState(false);
  const [fbErr, setFbErr] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const hasFix = Boolean(fix.diff || fix.test);

  // A re-run brings a fresh verdict: reset the fix to the new suggestion.
  useEffect(() => {
    setFix({ diff: v.suggested_diff ?? null, test: v.suggested_test ?? null, note: null });
    setHistory([]);
    setAsking(false);
  }, [v.suggested_diff, v.suggested_test]);

  const redo = async (e: React.FormEvent) => {
    e.preventDefault();
    const f = feedback.trim();
    if (f.length < 8) return setFbErr("Tell the AI what you want instead (a sentence is enough).");
    setRegenBusy(true);
    setFbErr(null);
    try {
      const r = await regenerateFix(prId, v.req_id, f);
      setFix({ diff: r.suggested_diff, test: r.suggested_test, note: r.note });
      setHistory((h) => [...h, f]);
      setFeedback("");
      setAsking(false);
    } catch (err) {
      setFbErr(err instanceof Error ? err.message : "Could not regenerate the fix");
    } finally {
      setRegenBusy(false);
    }
  };

  return (
    <div
      data-tour="verdict"
      className={`${card} relative overflow-hidden p-4 pl-5 sm:p-5 sm:pl-6 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:opacity-80 ${ACCENT[v.verdict]}`}
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-slate-200">{v.req_id}</span>
            <StatusBadge status={v.verdict} />
            {v.override && (
              <span className="rounded-full border border-cyan-300/30 bg-cyan-400/10 px-2 py-0.5 text-xs font-medium text-cyan-200">
                Overridden by {v.override.author}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-100">{v.requirement}</p>
        </div>
        <div className="flex shrink-0 flex-row flex-wrap items-center gap-2 text-xs text-slate-400 sm:flex-col sm:items-end sm:gap-1">
          <span>
            Confidence <span className="font-semibold tabular-nums text-slate-200">{Math.round(v.confidence * 100)}%</span>
          </span>
          <span
            className={`rounded-md border px-2 py-0.5 font-medium ${
              v.model === "super"
                ? "border-violet-400/30 bg-violet-400/10 text-violet-200"
                : "border-cyan-300/25 bg-cyan-400/[0.07] text-cyan-200"
            }`}
            title={v.thinking ? "Deep pass: Nemotron Super with thinking on" : "Fast pass: Nemotron Lightning, thinking off"}
          >
            {v.model === "super" ? "Super · thinking on" : "Lightning · fast"} · {(v.latency_ms / 1000).toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Reasoning */}
      <p className="mt-3 text-sm text-slate-400">{v.reasoning}</p>

      {/* Evidence Guard */}
      {v.downgraded_from && (
        <div data-tour="guard" className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/[0.06] px-3 py-2 text-sm text-amber-50">
          <span className="font-semibold text-amber-200">Evidence Guard:</span> the model said &ldquo;{STATUS_LABEL[v.downgraded_from]}&rdquo;,
          but the code it quoted isn&rsquo;t in the diff. So we marked it <span className="font-semibold">Check needed</span>.
        </div>
      )}

      {v.evidence.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className={eyebrow}>Code evidence</p>
          {v.evidence.map((ev, i) => (
            <EvidenceBlock key={i} ev={ev} verified={v.evidence_verified} />
          ))}
        </div>
      )}

      {/* Fix suggestions */}
      {hasFix && (
        <details data-tour="fix" className="mt-3 rounded-lg border border-navy-700" open={v.verdict !== "met"}>
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-slate-300 hover:text-cyan-100">
            Suggested fix {fix.diff && "· code"} {fix.test && "· test"} {history.length > 0 && `· version ${history.length + 1}`}
          </summary>
          <div className="space-y-3 border-t border-navy-700 p-3">
            {fix.note && (
              <p className="rounded-lg border border-cyan-300/25 bg-cyan-400/[0.06] px-3 py-2 text-sm text-cyan-50"><Icon name="refresh" className="mr-1.5 h-4 w-4 align-[-3px]" />{fix.note}</p>
            )}
            {fix.diff && (
              <div>
                <p className={`${eyebrow} mb-1`}>Suggested code change</p>
                <DiffBlock diff={fix.diff} />
              </div>
            )}
            {fix.test && (
              <div>
                <p className={`${eyebrow} mb-1`}>Test that proves it works</p>
                <PlainCode code={fix.test} />
              </div>
            )}

            {/* Don't like the suggestion? Tell the AI what you want. */}
            {!asking ? (
              <button
                type="button"
                data-tour="redo-fix"
                onClick={() => setAsking(true)}
                className="text-sm font-medium text-cyan-200 hover:underline"
              >
                <span className="inline-flex items-center gap-1.5"><Icon name="refresh" /> Not the fix you want? Tell the AI your requirements</span>
              </button>
            ) : (
              <form onSubmit={redo} className="space-y-2 rounded-lg border border-cyan-300/25 bg-cyan-400/[0.04] p-3">
                <label className="block text-sm font-medium text-slate-100" htmlFor={`fb-${v.req_id}`}>
                  What should the fix do instead?
                </label>
                <p className="text-xs text-slate-300">e.g. &ldquo;Use a config value instead of hard-coding 24&rdquo;, &ldquo;Use POST /cancel, not DELETE&rdquo;, &ldquo;Return 409 not 400&rdquo;</p>
                <textarea
                  id={`fb-${v.req_id}`}
                  autoFocus
                  rows={3}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  className={`${input} w-full px-3 py-2 placeholder:text-slate-500`}
                  placeholder="Describe what you want…"
                />
                {fbErr && <p className="text-xs text-rose-300">{fbErr}</p>}
                <div className="flex gap-2">
                  <button type="submit" disabled={regenBusy} className={btnPrimary + " !px-3 !py-1.5"}>
                    {regenBusy ? "Rewriting with Nemotron Super…" : "Rewrite the fix"}
                  </button>
                  <button type="button" onClick={() => setAsking(false)} className="px-2 text-sm text-slate-400 hover:text-slate-100">
                    Cancel
                  </button>
                </div>
              </form>
            )}
            {history.length > 0 && (
              <p className="text-xs text-slate-400">Your feedback so far: {history.map((h) => `“${h}”`).join(" → ")}</p>
            )}
          </div>
        </details>
      )}

      {/* Override */}
      {v.override && (
        <div className="mt-3 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.05] px-3 py-2 text-sm text-slate-200">
          <span className="font-semibold text-cyan-200">Human override:</span> {STATUS_LABEL[v.override.original_verdict]} →{" "}
          {STATUS_LABEL[v.override.new_verdict]}. &ldquo;{v.override.reason}&rdquo;
        </div>
      )}

      {showOverride ? (
        <OverrideForm
          prId={prId}
          reqId={v.req_id}
          current={v.verdict}
          onCancel={() => setShowOverride(false)}
          onDone={(o) => {
            setShowOverride(false);
            onOverridden(o);
          }}
        />
      ) : (
        <div className="mt-3 flex justify-end">
          <button
            data-tour="override"
            onClick={() => setShowOverride(true)}
            className={btnGhost}
            title="The AI's verdict (met / missing / …) is wrong? Change it and say why."
          >
            Override verdict
          </button>
        </div>
      )}
    </div>
  );
}
