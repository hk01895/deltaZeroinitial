"use client";

import { useState } from "react";
import type { Override, RequirementVerdict } from "@/lib/types";
import StatusBadge, { STATUS_LABEL } from "./StatusBadge";
import { DiffBlock, EvidenceBlock, PlainCode } from "./CodeBlock";
import OverrideForm from "./OverrideForm";

const BORDER: Record<RequirementVerdict["verdict"], string> = {
  met: "border-l-emerald-500",
  partial: "border-l-amber-500",
  missing: "border-l-rose-500",
  needs_human: "border-l-sky-500",
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
    <div className={`rounded-xl border border-l-4 border-slate-200 bg-white p-5 shadow-sm ${BORDER[v.verdict]}`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-slate-700">{v.req_id}</span>
            <StatusBadge status={v.verdict} />
            {v.override && (
              <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                Overridden by {v.override.author}
              </span>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-800">{v.requirement}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-slate-500">
          <span>
            Confidence <span className="font-semibold tabular-nums text-slate-700">{Math.round(v.confidence * 100)}%</span>
          </span>
          <span
            className={`rounded-md px-2 py-0.5 font-medium ${
              v.model === "super" ? "bg-violet-100 text-violet-800" : "bg-lime-100 text-lime-800"
            }`}
            title={v.thinking ? "Deep pass: Nemotron Super with thinking on" : "Fast pass: Nemotron Lightning, thinking off"}
          >
            {v.model === "super" ? "Super · thinking on" : "Lightning · fast"} · {(v.latency_ms / 1000).toFixed(1)}s
          </span>
        </div>
      </div>

      {/* Reasoning */}
      <p className="mt-3 text-sm text-slate-600">{v.reasoning}</p>

      {/* Evidence Guard */}
      {v.downgraded_from && (
        <div className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          <span className="font-semibold">Evidence Guard:</span> the model said &ldquo;{STATUS_LABEL[v.downgraded_from]}&rdquo;, but the
          code it quoted isn&rsquo;t in the diff. Downgraded to <span className="font-semibold">Needs human</span>.
        </div>
      )}

      {v.evidence.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Code evidence</p>
          {v.evidence.map((ev, i) => (
            <EvidenceBlock key={i} ev={ev} verified={v.evidence_verified} />
          ))}
        </div>
      )}

      {/* Fix suggestions */}
      {hasFix && (
        <details className="group mt-3 rounded-lg border border-slate-200" open={v.verdict !== "met"}>
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Suggested fix {v.suggested_diff && "· diff"} {v.suggested_test && "· test"}
          </summary>
          <div className="space-y-3 border-t border-slate-200 p-3">
            {v.suggested_diff && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested diff</p>
                <DiffBlock diff={v.suggested_diff} />
              </div>
            )}
            {v.suggested_test && (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Suggested test</p>
                <PlainCode code={v.suggested_test} />
              </div>
            )}
          </div>
        </details>
      )}

      {/* Override */}
      {v.override && (
        <div className="mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-900">
          <span className="font-semibold">Human override:</span> {STATUS_LABEL[v.override.original_verdict]} →{" "}
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
            onClick={() => setShowOverride(true)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Override
          </button>
        </div>
      )}
    </div>
  );
}
