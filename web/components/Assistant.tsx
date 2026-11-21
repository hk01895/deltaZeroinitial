"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ask, logChange, type AssistantReply } from "@/lib/assistant";
import { useSector } from "./SectorProvider";
import { btnPrimary, input } from "@/lib/ui";

// "Ask Δ": floating chat. Answers questions, drafts tickets, and applies changes,
// or pushes back when a change looks like a bad idea (you can still override it).
//
// Other components can open it with:
//   window.dispatchEvent(new CustomEvent("dz:ask", { detail: { message: "...", send: true } }))

type Msg =
  | { role: "user"; text: string }
  | ({ role: "bot"; id: number; resolved?: "kept_spec" | "overridden" } & AssistantReply);

const SUGGESTIONS = [
  "What's left?",
  "Are we ready to ship?",
  "Why is REQ-004 failing?",
  "Draft a ticket for REQ-009",
  "Change cancellations to 12 hours",
  "Skip the audit log",
];

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <span key={i} className="block min-h-[0.5rem]">
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? (
              <strong key={j} className="font-semibold text-slate-50">
                {part.slice(2, -2)}
              </strong>
            ) : (
              <span key={j}>{part}</span>
            ),
          )}
        </span>
      ))}
    </>
  );
}

let nextId = 1;

export default function Assistant() {
  const { sector } = useSector();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [overrideFor, setOverrideFor] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [reasonErr, setReasonErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const send = async (message: string) => {
    const m = message.trim();
    if (!m || busy) return;
    setMsgs((x) => [...x, { role: "user", text: m }]);
    setText("");
    setBusy(true);
    try {
      const r = await ask(m, sector);
      setMsgs((x) => [...x, { role: "bot", id: nextId++, ...r }]);
    } catch {
      setMsgs((x) => [...x, { role: "bot", id: nextId++, reply: "Something went wrong. Try again?" }]);
    } finally {
      setBusy(false);
    }
  };

  // Open from anywhere (used by the guided demo)
  useEffect(() => {
    const onAsk = (e: Event) => {
      const d = (e as CustomEvent<{ message?: string; send?: boolean; close?: boolean }>).detail ?? {};
      if (d.close) return setOpen(false);
      setOpen(true);
      if (d.message && d.send) setTimeout(() => send(d.message!), 250);
      else if (d.message) setText(d.message);
    };
    window.addEventListener("dz:ask", onAsk);
    return () => window.removeEventListener("dz:ask", onAsk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sector]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy, overrideFor]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const resolve = (id: number, how: "kept_spec" | "overridden", why?: string) => {
    const m = msgs.find((x) => x.role === "bot" && x.id === id) as Extract<Msg, { role: "bot" }> | undefined;
    if (!m?.pushback) return;
    logChange({ change: m.pushback.change, req_id: m.pushback.req_id, decision: how, reason: why });
    setMsgs((x) => [
      ...x.map((y) => (y.role === "bot" && y.id === id ? { ...y, resolved: how } : y)),
      {
        role: "bot",
        id: nextId++,
        reply:
          how === "kept_spec"
            ? "Kept the spec. ✓ Nothing changed."
            : `Override recorded. I applied the change and saved your reason:\n"${why}"\nReviewers will see it, and I'll take it into account next time.`,
      },
    ]);
    setOverrideFor(null);
    setReason("");
    setReasonErr(null);
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          data-tour="ask"
          onClick={() => setOpen(true)}
          aria-label="Open Ask Delta assistant"
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-cyan-300/40 bg-navy-900/90 px-4 py-3 text-sm font-medium text-cyan-100 shadow-[0_0_28px_-6px_rgba(103,232,249,0.6)] backdrop-blur transition hover:bg-navy-800 sm:bottom-6 sm:right-6"
        >
          <span className="text-base font-bold text-cyan-300">Δ</span> Ask Δ
        </button>
      )}

      {/* Panel */}
      {open && (
        <div
          data-tour="ask-panel"
          role="dialog"
          aria-label="Ask Delta assistant"
          className="fixed inset-x-0 bottom-0 z-40 flex h-[85vh] flex-col border-t border-cyan-300/20 bg-navy-950/95 shadow-[0_0_40px_-10px_rgba(103,232,249,0.45)] backdrop-blur-md sm:inset-x-auto sm:bottom-6 sm:right-6 sm:h-[560px] sm:w-[400px] sm:rounded-2xl sm:border"
        >
          <div className="flex items-center justify-between border-b border-navy-700/70 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-50">
                <span className="text-cyan-300">Δ</span> Ask Δ
              </p>
              <p className="text-xs text-slate-400">Ask anything, or tell me a change. I&rsquo;ll push back if it&rsquo;s risky.</p>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close assistant" className="rounded-md px-2 py-1 text-lg text-slate-400 hover:text-slate-100">
              ×
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {msgs.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-slate-300">Try one of these:</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-navy-600 bg-navy-900 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-300/40 hover:text-cyan-100"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-cyan-400/15 px-3 py-2 text-sm text-cyan-50">{m.text}</p>
                </div>
              ) : (
                <div key={i} className="max-w-[92%] space-y-2">
                  <div className="rounded-2xl rounded-bl-sm border border-navy-700 bg-navy-900 px-3 py-2 text-sm leading-6 text-slate-200">
                    <Rich text={m.reply} />
                  </div>

                  {m.pushback && (
                    <div className="rounded-xl border border-amber-300/30 bg-amber-300/[0.06] p-3 text-sm" data-tour="pushback">
                      <p className="font-semibold text-amber-200">⚠ Pushback</p>
                      <p className="mt-1 leading-6 text-slate-200">
                        <Rich text={m.pushback.rule} />
                      </p>
                      <p className="mt-1 leading-6 text-slate-300">
                        <span className="font-semibold text-slate-100">Suggestion: </span>
                        {m.pushback.suggestion}
                      </p>

                      {!m.resolved && overrideFor !== m.id && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button onClick={() => resolve(m.id, "kept_spec")} className={btnPrimary + " !px-3 !py-1.5"}>
                            Keep the spec
                          </button>
                          <button
                            data-tour="override-anyway"
                            onClick={() => setOverrideFor(m.id)}
                            className="rounded-md border border-navy-600 px-3 py-1.5 text-sm text-slate-300 hover:border-amber-300/50 hover:text-amber-100"
                          >
                            Do it anyway
                          </button>
                        </div>
                      )}

                      {!m.resolved && overrideFor === m.id && (
                        <form
                          className="mt-3 space-y-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (reason.trim().length < 10) return setReasonErr("Give a reason (at least 10 characters) so reviewers understand.");
                            resolve(m.id, "overridden", reason.trim());
                          }}
                        >
                          <label className="block text-xs text-slate-300">
                            Why are you overriding? <span className="text-rose-300">*</span>
                          </label>
                          <input
                            autoFocus
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. The API gateway already audit-logs every read"
                            className={`${input} w-full placeholder:text-slate-500`}
                          />
                          {reasonErr && <p className="text-xs text-rose-300">{reasonErr}</p>}
                          <div className="flex gap-2">
                            <button type="submit" className="rounded-md border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-sm font-medium text-amber-100">
                              Override
                            </button>
                            <button type="button" onClick={() => setOverrideFor(null)} className="px-2 text-sm text-slate-400 hover:text-slate-200">
                              Cancel
                            </button>
                          </div>
                        </form>
                      )}

                      {m.resolved && (
                        <p className="mt-2 text-xs font-medium text-slate-400">
                          {m.resolved === "kept_spec" ? "✓ You kept the spec" : "↯ You overrode this (reason saved)"}
                        </p>
                      )}
                    </div>
                  )}

                  {m.links && (
                    <div className="flex flex-wrap gap-2">
                      {m.links.map((l) => (
                        <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-xs font-medium text-cyan-200 hover:underline">
                          {l.label} →
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ),
            )}

            {busy && (
              <p className="text-sm text-slate-400">
                <span className="animate-pulse">Δ is thinking…</span>
              </p>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(text);
            }}
            className="flex gap-2 border-t border-navy-700/70 p-3"
          >
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ask or request a change…"
              aria-label="Message Ask Delta"
              className={`${input} min-w-0 flex-1 px-3 py-2 placeholder:text-slate-500`}
            />
            <button type="submit" disabled={busy || !text.trim()} className={btnPrimary + " !px-3"}>
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}
