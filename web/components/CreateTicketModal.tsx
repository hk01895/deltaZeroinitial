"use client";

import { useEffect, useState } from "react";
import { createTicket, draftTicket } from "@/lib/api";
import type { CoverageRow, TicketDraft } from "@/lib/types";
import { btnPrimary, input } from "@/lib/ui";

// "Create ticket" for a lost requirement: the AI drafts a precise ticket,
// you edit it, and creating it moves the requirement out of "Lost".
export default function CreateTicketModal({
  row,
  onClose,
  onCreated,
}: {
  row: CoverageRow;
  onClose: () => void;
  onCreated: (ticketKey: string) => void;
}) {
  const [draft, setDraft] = useState<TicketDraft | null>(null);
  const [criteria, setCriteria] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    draftTicket(row)
      .then((d) => {
        setDraft(d);
        setCriteria(d.acceptance_criteria.join("\n"));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Could not draft the ticket"));
  }, [row]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const ac = criteria
      .split("\n")
      .map((x) => x.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
    if (!draft.title.trim()) return setError("Give the ticket a title.");
    if (!ac.length) return setError("Add at least one acceptance criterion so DeltaZero can check the code later.");
    setSaving(true);
    setError(null);
    try {
      const t = await createTicket({ ...draft, acceptance_criteria: ac });
      onCreated(t.ticket_key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the ticket");
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-end justify-center bg-[rgba(3,6,15,0.7)] p-0 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose}>
      <form
        role="dialog"
        aria-label={`Create a ticket for ${row.req_id}`}
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full overflow-y-auto rounded-t-2xl border border-cyan-300/25 bg-navy-900 p-5 sm:max-w-lg sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-rose-200">Lost · {row.req_id}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-50">Create a ticket</h2>
            <p className="mt-1 text-sm text-slate-300">DeltaZero drafted a precise ticket from the spec. Edit anything, then create it.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded px-2 text-xl leading-none text-slate-400 hover:text-slate-100">
            ×
          </button>
        </div>

        {!draft ? (
          error ? (
            <p className="mt-6 text-sm text-rose-300">{error}</p>
          ) : (
            <p className="mt-6 animate-pulse text-sm text-slate-300">Drafting with the Ticket Sharpener…</p>
          )
        ) : (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-400/25 bg-emerald-400/[0.06] px-3 py-2 text-sm">
              <span className="font-semibold text-emerald-200">Precision {draft.precision_score}/100</span>
              <span className="text-slate-300">· {draft.issues.join(" · ")}</span>
            </div>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-300">Title</span>
              <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={`${input} w-full px-3 py-2`} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-xs text-slate-300">Acceptance criteria (one per line). This is what DeltaZero will check the code against.</span>
              <textarea value={criteria} onChange={(e) => setCriteria(e.target.value)} rows={5} className={`${input} w-full px-3 py-2 leading-6`} />
            </label>
            <p className="text-xs text-slate-400">{draft.description}</p>
            {error && <p className="text-sm text-rose-300">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm text-slate-300 hover:text-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className={btnPrimary} data-tour="create-ticket-submit">
                {saving ? "Creating…" : "Create ticket"}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
