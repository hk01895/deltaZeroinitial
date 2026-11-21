// "Ask Δ" assistant. In live mode it calls POST /assistant (backend + Nemotron).
// In mock mode (or if the call fails) a small rule-based brain answers using
// the same coverage data, so the demo always works.

import { getCoverage, getPRs, USING_MOCK } from "./api";
import { mockRulePacks } from "./mock";
import { look } from "@/components/StatusBadge";
import type { CoverageRow, Sector } from "./types";

export interface Pushback {
  rule: string; // why the bot disagrees
  suggestion: string; // what it recommends instead
  change: string; // the change the user asked for
  req_id: string | null;
}

export interface AssistantReply {
  reply: string; // markdown-lite: **bold** and line breaks
  pushback?: Pushback | null;
  links?: { label: string; href: string }[];
}

export interface ChangeLogEntry {
  change: string;
  req_id: string | null;
  decision: "applied" | "kept_spec" | "overridden";
  reason?: string;
  at: string;
}

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const changeLog: ChangeLogEntry[] = [];

export function logChange(e: Omit<ChangeLogEntry, "at">) {
  const entry = { ...e, at: new Date().toISOString() };
  changeLog.push(entry);
  if (!USING_MOCK) {
    fetch(`${API_URL}/assistant/changes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(entry),
    }).catch(() => {});
  }
  return entry;
}

export async function ask(message: string, sector: Sector): Promise<AssistantReply> {
  if (!USING_MOCK) {
    try {
      const res = await fetch(`${API_URL}/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, sector }),
      });
      if (res.ok) return (await res.json()) as AssistantReply;
    } catch {
      /* fall through to mock */
    }
  }
  await new Promise((r) => setTimeout(r, 450)); // feels like thinking
  return mockBrain(message, sector);
}

// ---------------------------------------------------------------------------
// Mock brain

const WEAKEN = /\b(skip|remove|drop|disable|turn off|get rid of|no longer|don'?t (need|log|encrypt|test)|without|ignore|plain ?text|unencrypted|no tests?)\b/i;

const TOPICS: { req_id: string; words: RegExp }[] = [
  { req_id: "REQ-001", words: /\bbook(ing|ings|s)?\b/i },
  { req_id: "REQ-002", words: /\b(double|twice|409|duplicate)\b/i },
  { req_id: "REQ-003", words: /\b(email|confirmation)\b/i },
  { req_id: "REQ-004", words: /\bcancel/i },
  { req_id: "REQ-005", words: /\baudit|log(s|ging)?\b/i },
  { req_id: "REQ-006", words: /\bschedule\b/i },
  { req_id: "REQ-007", words: /\b(session|timeout|inactiv)/i },
  { req_id: "REQ-008", words: /\b(encrypt|phone number)/i },
  { req_id: "REQ-009", words: /\b(sms|reminder|text message)/i },
  { req_id: "REQ-010", words: /\b(pdf|export)\b/i },
];

function findReq(msg: string, rows: CoverageRow[]): CoverageRow | null {
  const id = msg.match(/req[-\s]?0*(\d{1,3})/i);
  if (id) return rows.find((r) => r.req_id === `REQ-${id[1].padStart(3, "0")}`) ?? null;
  const t = TOPICS.find((t) => t.words.test(msg));
  return t ? rows.find((r) => r.req_id === t.req_id) ?? null : null;
}

const numbers = (s: string) => (s.match(/\d+(\.\d+)?\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|%|mb)?/gi) ?? []).map((x) => x.trim().toLowerCase());

function ruleFor(sector: Sector, msg: string): string | null {
  const pack = mockRulePacks[sector];
  const m = msg.toLowerCase();
  const hit =
    pack.rules.find((r) => /audit/i.test(r.text) && /audit|log/.test(m)) ??
    pack.rules.find((r) => /encrypt/i.test(r.text) && /encrypt|plain/.test(m)) ??
    pack.rules.find((r) => /test/i.test(r.text) && /test/.test(m)) ??
    pack.rules.find((r) => /idempot/i.test(r.text) && /idempot|retry/.test(m)) ??
    null;
  return hit ? `${hit.id}: ${hit.text}` : null;
}

function trace(r: CoverageRow) {
  const t = r.ticket_key ? r.ticket_key : "no ticket";
  const p = r.pr_id ? `PR #${r.pr_id} (${r.status === "met" ? "done" : r.status === "partial" ? "partly done" : "not done"})` : "no PR yet";
  return `Spec → ${t} → ${p}`;
}

function draftTicket(r: CoverageRow) {
  return (
    `Here's a sharpened ticket for **${r.req_id}**:\n\n` +
    `**Title:** ${r.text.replace(/\.$/, "")}\n` +
    `**Acceptance criteria:**\n` +
    `• ${r.text}\n` +
    `• Happy path and one failure case are covered by automated tests\n` +
    `• Behaviour is logged so it can be verified in review\n\n` +
    `Precision score: **88/100** (has a clear actor, trigger and measurable outcome).`
  );
}

async function mockBrain(raw: string, sector: Sector): Promise<AssistantReply> {
  const msg = raw.trim();
  const m = msg.toLowerCase();
  const cov = await getCoverage(sector);
  const rows = cov.requirements;
  const open = rows.filter((r) => r.status !== "met");
  const delta = open.length;

  if (!msg || /^(hi|hey|hello|help|what can you do)\b/.test(m)) {
    return {
      reply:
        "Hi! I'm **Ask Δ**. I can:\n" +
        "• tell you what's missing (\"what's left?\")\n" +
        "• explain a requirement (\"why is REQ-004 failing?\")\n" +
        "• draft a ticket (\"draft a ticket for REQ-009\")\n" +
        "• make a change (\"change cancellations to 12 hours\"). If I think it's a bad idea I'll push back, and you can still override me with a reason.",
    };
  }

  // Ready to ship?
  if (/\b(ready|ship|release|launch)\b|\bdone\?/.test(m) && !/\b(change|make|set)\b/.test(m)) {
    if (delta === 0) return { reply: "**Yes.** Δ is 0: every requirement in the spec is verified in code." };
    return {
      reply:
        `**Not yet.** Δ is **${delta}**. Blockers:\n` +
        open.map((r) => `• **${r.req_id}** ${r.reason ?? r.text}`).join("\n"),
      links: [{ label: "See requirement map", href: "/" }],
    };
  }

  // What's missing?
  if (/missing|left|gap|status|broken|lost|what('?s| is) (wrong|open)/.test(m)) {
    if (delta === 0) return { reply: "Nothing! Δ is 0. Everything you promised shipped." };
    return {
      reply: `**${delta} requirement${delta > 1 ? "s" : ""}** still open:\n` + open.map((r) => `• **${r.req_id}** (${look(r.status, "coverage").label}): ${r.text}`).join("\n"),
    };
  }

  const req = findReq(msg, rows);

  // Draft a ticket
  if (/draft|ticket|write.*ticket/.test(m) && !/change|make|set|update/.test(m)) {
    const target = req ?? rows.find((r) => r.status === "never_ticketed");
    if (!target) return { reply: "Every requirement already has a ticket. Which one should I rewrite?" };
    return { reply: draftTicket(target), links: [{ label: "Open Ticket Sharpener", href: `/sharpener?req=${target.req_id}&text=${encodeURIComponent(target.text)}` }] };
  }

  // Explain a requirement
  if (req && /why|explain|what about|status of|how is/.test(m)) {
    return {
      reply: `**${req.req_id}**: ${req.text}\n\nStatus: **${look(req.status, "coverage").label}**\nTrail: ${trace(req)}` + (req.reason ? `\nWhy: ${req.reason}` : ""),
      links: req.pr_id ? [{ label: `Open PR #${req.pr_id}`, href: `/pr/${req.pr_id}` }] : undefined,
    };
  }

  // Change requests: apply, or push back
  if (/change|make|set|update|instead|switch|move|let'?s|should|can we|remove|skip|drop|disable|add/.test(m)) {
    const rule = WEAKEN.test(msg) ? ruleFor(sector, msg) : null;
    if (rule) {
      return {
        reply: "I'd push back on this one.",
        pushback: {
          change: msg,
          req_id: req?.req_id ?? null,
          rule: `This goes against the active **${mockRulePacks[sector].name}** rule pack (${rule}).`,
          suggestion: "Keep the requirement as written. If there's a real reason (e.g. another system already does it), override with that reason so reviewers can see it.",
        },
      };
    }
    if (req) {
      const specNums = numbers(req.text);
      const askNums = numbers(msg);
      const conflict = askNums.find((n) => specNums.length && !specNums.includes(n));
      if (conflict) {
        return {
          reply: "Heads up, that conflicts with the spec.",
          pushback: {
            change: msg,
            req_id: req.req_id,
            rule: `The spec for **${req.req_id}** says "${req.text}" You asked for **${conflict}**. Changing it here would create drift between the spec and the code.`,
            suggestion: "Update the spec first (so everyone agrees), or keep the spec value.",
          },
        };
      }
      if (WEAKEN.test(msg)) {
        return {
          reply: `That would remove part of **${req.req_id}**.`,
          pushback: {
            change: msg,
            req_id: req.req_id,
            rule: `Removing it means a promised requirement will never ship, and Δ can't reach 0.`,
            suggestion: "If it's truly out of scope, override with the reason so it's recorded.",
          },
        };
      }
      logChange({ change: msg, req_id: req.req_id, decision: "applied" });
      return {
        reply: `Done. I logged that change against **${req.req_id}** and sent it to the Ticket Sharpener so the ticket stays precise.\nTrail: ${trace(req)}`,
      };
    }
    logChange({ change: msg, req_id: null, decision: "applied" });
    return {
      reply: "Got it. That doesn't match an existing requirement, so I logged it as a **new requirement** and sent it to the Ticket Sharpener to make it precise.",
      links: [{ label: "Open Ticket Sharpener", href: `/sharpener?text=${encodeURIComponent(msg)}` }],
    };
  }

  if (req) {
    return { reply: `**${req.req_id}**: ${req.text}\nStatus: **${look(req.status, "coverage").label}** · ${trace(req)}` };
  }

  return {
    reply: "I'm not sure what you mean. Try \"what's left?\", \"why is REQ-004 failing?\", \"draft a ticket for REQ-009\" or \"change cancellations to 12 hours\".",
  };
}
