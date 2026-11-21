"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { resetDemo } from "@/lib/api";

// Guided "Live demo": walks through every feature with a spotlight and a
// plain-English caption. Start it with:
//   window.dispatchEvent(new Event("dz:tour"))

interface Step {
  path: string;
  target: string; // matches data-tour="..."
  title: string;
  body: string;
  next?: string; // label for the Next button
  onEnter?: () => void;
  onNext?: () => void; // runs before moving on (e.g. clicks a button)
  settle?: number; // ms to wait after onNext
}

const click = (t: string) => (document.querySelector(`[data-tour="${t}"]`) as HTMLElement | null)?.click();
const askEvent = (detail: object) => window.dispatchEvent(new CustomEvent("dz:ask", { detail }));

const STEPS: Step[] = [
  {
    path: "/",
    target: "delta",
    title: "Δ = promises not kept yet",
    body: "Imagine you promised a friend 10 cookies and you've only handed over 4. This big number is how many you still owe: 6. DeltaZero's whole job is getting it to 0.",
  },
  {
    path: "/",
    target: "bar",
    title: "Three colors, that's it",
    body: "Only three: green = done, yellow = in progress, red = lost (in the plan, but nobody made a ticket). Each card's \"Why\" line says exactly what's left.",
  },
  {
    path: "/",
    target: "lost",
    title: "Lost promises",
    body: "These were in the original plan, but nobody ever made a to-do (a ticket) for them. Other tools only check tickets, so they can't see these. Click \"+ Create ticket\" and the AI writes a clear ticket, which moves it out of Lost.",
  },
  {
    path: "/",
    target: "prs",
    title: "Pull requests = homework handed in",
    body: "A pull request is a developer saying \"here's my code.\" The score shows how many promises it keeps. PR #12 keeps only 2 of 5. Paste any GitHub PR link to check it. Once the GitHub App is installed, every push is checked automatically.",
  },
  {
    path: "/",
    target: "map",
    title: "Requirement map",
    body: "Every promise, problems first. Each card says what's wrong in plain words and shows the trail Spec → Ticket → PR, so you can see exactly where it got lost.",
  },
  {
    path: "/pr/12",
    target: "score",
    title: "Checking one piece of homework",
    body: "This is PR #12. NVIDIA Nemotron read the code and checked it against each promise on its ticket. Only 2 of 5 are kept.",
  },
  {
    path: "/pr/12",
    target: "verdict",
    title: "One card per promise",
    body: "The AI says Met, Not met, or Check needed, and how sure it is. \"Lightning · fast\" means a quick check. \"Super · thinking on\" means the AI thought harder, which we only do for tricky ones to save time.",
  },
  {
    path: "/pr/12",
    target: "fix",
    title: "It doesn't just complain, it helps",
    body: "For every missing promise, it writes the code change (green lines) and a test that proves it works. Don't like it? Click \"Not the fix you want?\", type what you want instead, and it rewrites the fix.",
  },
  {
    path: "/pr/12",
    target: "guard",
    title: "Evidence Guard: show your work",
    body: "The AI must quote the exact code as proof. Here it pointed to code that isn't really there, so we don't trust it and mark it \"Check needed\" for a person. Like a teacher saying \"show your work.\"",
  },
  {
    path: "/pr/12",
    target: "override",
    title: "Humans get the last word",
    body: "If the AI's grade is wrong (say it marked something missing that's actually handled elsewhere), click \"Override verdict\" and write why. The reason is saved, and the AI learns from it next time.",
  },
  {
    path: "/pr/12",
    target: "rules",
    title: "Rule packs for different jobs",
    body: "Hospitals and banks have extra rules, like \"always log who looked at patient data.\" Switch Medical / Finance at the top and the checks change.",
  },
  {
    path: "/pr/12",
    target: "rerun",
    title: "The developer fixed it",
    body: "They pushed a new version of their code. Let's check it again.",
    next: "Re-run check ▶",
    onNext: () => click("rerun"),
    settle: 900,
  },
  {
    path: "/pr/12",
    target: "score",
    title: "5 out of 5!",
    body: "Every promise on this ticket is kept now. The card turned green and says ready to merge.",
  },
  {
    path: "/",
    target: "delta",
    title: "The Δ went down",
    body: "Back home, the Δ counted down from 6 to 3. Three promises left.",
  },
  {
    path: "/",
    target: "ask-panel",
    title: "Ask Δ: a helper you can talk to",
    body: "Someone asked to change cancellations from 24 hours to 12. The bot pushes back because that breaks the original plan. You can click \"Keep the spec,\" or \"Do it anyway\" and give a reason.",
    onEnter: () => askEvent({ message: "Change cancellations to 12 hours", send: true }),
  },
  {
    path: "/",
    target: "sprint",
    title: "Fast-forward a week",
    body: "The team builds the last few promises. Let's skip ahead.",
    next: "Ship the rest ▶",
    onEnter: () => askEvent({ close: true }),
    onNext: () => click("sprint"),
    settle: 400,
  },
  {
    path: "/",
    target: "delta",
    title: "Δ 0, every promise kept 🎉",
    body: "No difference between what was promised and what shipped. That's the goal, and the name: DeltaZero.",
  },
  {
    path: "/eval",
    target: "eval",
    title: "Can you trust the AI?",
    body: "We tested it on 30 examples where we already knew the right answer. It caught 94% of real problems, and we show the mistakes too, so nothing is hidden.",
  },
  {
    path: "/sharpener",
    target: "sharpener",
    title: "Ticket Sharpener",
    body: "Stops vague to-dos before work even starts. \"Make it fast\" becomes \"page loads in under 2 seconds.\" Clear tickets mean the AI checks are more accurate too.",
    next: "Finish",
  },
];

type Rect = { top: number; left: number; width: number; height: number };

export function LiveDemoButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new Event("dz:tour"))}
      className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-cyan-300/40 bg-cyan-400/10 px-2.5 py-1.5 text-xs font-medium text-cyan-100 shadow-[0_0_16px_-8px_rgba(103,232,249,0.7)] transition hover:bg-cyan-400/20 sm:text-sm"
    >
      ▶ <span className="hidden min-[380px]:inline">Live demo</span>
      <span className="min-[380px]:hidden">Demo</span>
    </button>
  );
}

export default function Tour() {
  const router = useRouter();
  const pathname = usePathname();
  const [i, setI] = useState<number | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [busy, setBusy] = useState(false);
  const [vw, setVw] = useState(1200);
  const [vh, setVh] = useState(800);

  const step = i === null ? null : STEPS[i];

  const stop = useCallback(() => {
    setI(null);
    setRect(null);
  }, []);

  // Start
  useEffect(() => {
    const start = () => {
      resetDemo();
      window.dispatchEvent(new Event("dz:refresh"));
      window.dispatchEvent(new CustomEvent("dz:ask", { detail: { close: true } }));
      setI(0);
    };
    window.addEventListener("dz:tour", start);
    return () => window.removeEventListener("dz:tour", start);
  }, []);

  // Navigate to the step's page, run onEnter
  useEffect(() => {
    if (!step) return;
    const here = pathname.split("?")[0];
    if (here !== step.path) router.push(step.path);
    step.onEnter?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // Find and spotlight the target
  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
    setVw(window.innerWidth);
    setVh(window.innerHeight);
    if (!el) return setRect(null);
    const r = el.getBoundingClientRect();
    const top = Math.max(r.top, 8);
    const bottom = Math.min(r.bottom, window.innerHeight - 8);
    setRect({ top, left: r.left, width: r.width, height: Math.max(0, bottom - top) });
  }, [step]);

  useLayoutEffect(() => {
    if (!step) return;
    setRect(null);
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const find = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`) as HTMLElement | null;
      if (el && el.getBoundingClientRect().height > 0) {
        const fixed = getComputedStyle(el).position === "fixed";
        if (!fixed) {
          const tall = el.getBoundingClientRect().height > window.innerHeight * 0.55;
          el.scrollIntoView({ block: tall ? "start" : "center", behavior: "auto" });
          if (tall) window.scrollBy(0, -80);
        }
        timer = setTimeout(measure, 120);
      } else if (tries++ < 60) {
        timer = setTimeout(find, 100);
      } else {
        measure();
      }
    };
    timer = setTimeout(find, 150);
    return () => clearTimeout(timer);
  }, [step, pathname, measure]);

  useEffect(() => {
    if (!step) return;
    const on = () => measure();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    const poll = setInterval(on, 400); // targets can grow (e.g. chat replies)
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      clearInterval(poll);
    };
  }, [step, measure]);

  const go = useCallback(
    async (dir: 1 | -1) => {
      if (i === null || busy) return;
      if (dir === 1 && step?.onNext) {
        setBusy(true);
        step.onNext();
        await new Promise((r) => setTimeout(r, step.settle ?? 500));
        setBusy(false);
      }
      const n = i + dir;
      if (n < 0) return;
      if (n >= STEPS.length) return stop();
      setI(n);
    },
    [i, busy, step, stop],
  );

  // Keyboard: → next, ← back, Esc exit
  useEffect(() => {
    if (i === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") stop();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [i, go, stop]);

  if (!step || i === null) return null;

  const pad = 8;
  const mobile = vw < 640;
  const CARD_W = 360;
  const CARD_H = 230;
  let cardStyle: React.CSSProperties;
  if (mobile || !rect) {
    cardStyle = {};
  } else {
    const below = vh - (rect.top + rect.height + pad);
    const above = rect.top - pad;
    const left = Math.min(Math.max(rect.left, 16), vw - CARD_W - 16);
    if (below >= CARD_H) cardStyle = { top: rect.top + rect.height + pad + 12, left };
    else if (above >= CARD_H) cardStyle = { top: rect.top - pad - 12 - CARD_H, left };
    else if (rect.left > CARD_W + 40) cardStyle = { top: Math.max(16, Math.min(rect.top, vh - CARD_H - 16)), left: rect.left - CARD_W - 24 };
    else cardStyle = { bottom: 24, left: (vw - CARD_W) / 2 };
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-live="polite">
      {/* Spotlight */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-xl border-2 border-cyan-300/80 transition-all duration-300"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgba(3, 6, 15, 0.74), 0 0 28px 2px rgba(103, 232, 249, 0.35)",
          }}
        />
      ) : (
        <div className="pointer-events-none fixed inset-0 bg-[rgba(3,6,15,0.74)]" />
      )}

      {/* Caption */}
      <div
        role="dialog"
        aria-label={`Live demo step ${i + 1} of ${STEPS.length}: ${step.title}`}
        className={
          "pointer-events-auto fixed z-[61] border border-cyan-300/30 bg-navy-900/95 p-4 shadow-[0_0_40px_-10px_rgba(103,232,249,0.6)] backdrop-blur " +
          (mobile || !rect ? "inset-x-3 bottom-3 rounded-2xl" : "w-[360px] rounded-2xl")
        }
        style={cardStyle}
      >
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-cyan-300/80">
            Live demo · {i + 1}/{STEPS.length}
          </p>
          <button onClick={stop} aria-label="Exit live demo" className="rounded px-1.5 text-lg leading-none text-slate-400 hover:text-slate-100">
            ×
          </button>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-navy-800">
          <div className="h-full rounded-full bg-cyan-300/80 transition-all" style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
        </div>
        <h2 className="mt-3 text-base font-semibold text-slate-50">{step.title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-200">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <button onClick={() => go(-1)} disabled={i === 0 || busy} className="text-sm text-slate-400 hover:text-slate-100 disabled:opacity-30">
            ← Back
          </button>
          <button
            onClick={() => go(1)}
            disabled={busy}
            data-tour-next
            className="rounded-md border border-cyan-300/50 bg-cyan-400/15 px-4 py-1.5 text-sm font-medium text-cyan-50 shadow-[0_0_18px_-6px_rgba(103,232,249,0.7)] hover:bg-cyan-400/25 disabled:opacity-60"
          >
            {busy ? "…" : step.next ?? "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
