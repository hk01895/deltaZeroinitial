"use client";

import { useState } from "react";
import { postOverride } from "@/lib/api";
import type { Override, Verdict } from "@/lib/types";
import { STATUS_LABEL } from "./StatusBadge";
import { btnPrimary, input } from "@/lib/ui";

const VERDICTS: Verdict[] = ["met", "missing", "needs_human"];
const MIN_REASON = 10;

export default function OverrideForm({
  prId,
  reqId,
  current,
  onDone,
  onCancel,
}: {
  prId: number;
  reqId: string;
  current: Verdict;
  onDone: (o: Override) => void;
  onCancel: () => void;
}) {
  const norm = (v: Verdict): Verdict => (v === "partial" ? "missing" : v);
  const [verdict, setVerdict] = useState<Verdict>(current === "met" ? "missing" : "met");
  const [reason, setReason] = useState("");
  const [author, setAuthor] = useState("reviewer");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verdict === norm(current)) return setError("Pick a verdict different from the AI's.");
    if (reason.trim().length < MIN_REASON)
      return setError(`Explain why (at least ${MIN_REASON} characters). DeltaZero learns from this.`);
    setSaving(true);
    setError(null);
    try {
      const o = await postOverride(
        { pr_id: prId, req_id: reqId, new_verdict: verdict, reason: reason.trim(), author: author.trim() || "reviewer" },
        current,
      );
      onDone(o);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save override");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg border border-cyan-300/20 bg-cyan-400/[0.04] p-4">
      <p className="text-sm font-medium text-cyan-100">Override AI verdict for {reqId}</p>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-400">New verdict</span>
          <select value={verdict} onChange={(e) => setVerdict(e.target.value as Verdict)} className={input}>
            {VERDICTS.map((v) => (
              <option key={v} value={v} disabled={v === norm(current)}>
                {STATUS_LABEL[v]}
                {v === norm(current) ? " (current)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-400">Your name</span>
          <input value={author} onChange={(e) => setAuthor(e.target.value)} className={input} />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-slate-400">
          Reason <span className="text-rose-300">*</span> (used to teach the AI on future runs)
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Audit logging is handled by the API gateway, not in this service."
          className={`${input} w-full px-3 py-2 placeholder:text-slate-600`}
        />
      </label>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Saving…" : "Save override"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-slate-400 hover:text-slate-200">
          Cancel
        </button>
      </div>
    </form>
  );
}
