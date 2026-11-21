"use client";

import { useState } from "react";
import type { Override, RequirementVerdict } from "@/lib/types";
import StatusBadge, { STATUS_LABEL } from "./StatusBadge";
import { DiffBlock, EvidenceBlock, PlainCode } from "./CodeBlock";
import OverrideForm from "./OverrideForm";
import { btnGhost, card, eyebrow } from "@/lib/ui";

const ACCENT: Record<RequirementVerdict["verdict"], string> = {
  met: "before:bg-emerald-400",
  partial: "before:bg-amber-300",
  missing: "before:bg-rose-400",
  needs_human: "before:bg-sky-400",
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
  const hasFix = Boolean(v.suggested_diff || v.suggested_test);

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
        <div data-tour="guard" className="mt-3 rounded-lg border border-sky-400/25 bg-sky-400/[0.06] px-3 py-2 text-sm text-sky-100">
          <span className="font-semibold text-sky-300">Evidence Guard:</span> the model said &ldquo;{STATUS_LABEL[v.downgraded_from]}&rdquo;,
          but the code it quoted isn&rsquo;t in the diff. Downgraded to <span className="font-semibold">Needs human</span>.
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
            Suggested fix {v.suggested_diff && "· diff"} {v.suggested_test && "· test"}
          </summary>
          <div className="space-y-3 border-t border-navy-700 p-3">
            {v.suggested_diff && (
              <div>
                <p className={`${eyebrow} mb-1`}>Suggested diff</p>
                <DiffBlock diff={v.suggested_diff} />
              </div>
            )}
            {v.suggested_test && (
              <div>
                <p className={`${eyebrow} mb-1`}>Suggested test</p>
                <PlainCode code={v.suggested_test} />
              </div>
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
          <button data-tour="override" onClick={() => setShowOverride(true)} className={btnGhost}>
            Override
          </button>
        </div>
      )}
    </div>
  );
}
