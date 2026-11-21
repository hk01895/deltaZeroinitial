"use client";

import { useState } from "react";
import { postOverride } from "@/lib/api";
import type { Override, Verdict } from "@/lib/types";
import { STATUS_LABEL } from "./StatusBadge";

const VERDICTS: Verdict[] = ["met", "partial", "missing", "needs_human"];
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
  const [verdict, setVerdict] = useState<Verdict>(current === "met" ? "missing" : "met");
  const [reason, setReason] = useState("");
  const [author, setAuthor] = useState("reviewer");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verdict === current) return setError("Pick a verdict different from the AI's.");
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
    <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/50 p-4">
      <p className="text-sm font-medium text-indigo-900">Override AI verdict for {reqId}</p>
      <div className="flex flex-wrap gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-600">New verdict</span>
          <select
            value={verdict}
            onChange={(e) => setVerdict(e.target.value as Verdict)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {VERDICTS.map((v) => (
              <option key={v} value={v} disabled={v === current}>
                {STATUS_LABEL[v]}
                {v === current ? " (current)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-600">Your name</span>
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          />
        </label>
      </div>
      <label className="block text-sm">
        <span className="mb-1 block text-xs text-slate-600">
          Reason <span className="text-rose-600">*</span> (used to teach the AI on future runs)
        </span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="e.g. Audit logging is handled by the API gateway, not in this service."
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </label>
      {error && <p className="text-sm text-rose-700">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save override"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
      </div>
    </form>
  );
}
