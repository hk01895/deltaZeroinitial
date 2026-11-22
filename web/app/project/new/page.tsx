"use client";

import Icon from "@/components/Icon";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentProject, loadProject } from "@/lib/api";
import type { ProjectLoadResult, ProjectStatus } from "@/lib/types";
import { useSector } from "@/components/SectorProvider";
import { BackLink } from "@/components/AppShell";
import { btnPrimary, card, eyebrow, input } from "@/lib/ui";

// Load a real project:
//   GitHub repo + spec (or the repo's README)
//   → Nemotron splits the spec into requirements
//   → GitHub Issues become the tickets, matched to requirements
//   → PRs that close those issues are checked, and open PRs are watched for new pushes

const STEPS = [
  { key: "spec", label: "Reading the spec", detail: "Nemotron Super splits it into requirements" },
  { key: "issues", label: "Reading GitHub issues", detail: "Issues become the tickets" },
  { key: "matching", label: "Matching requirements to issues", detail: "Requirements with no issue are Lost" },
  { key: "prs", label: "Checking pull requests", detail: "PRs that close an issue are verified, open ones are watched" },
  { key: "done", label: "Tracking", detail: "Every new push is re-checked" },
];

export default function NewProjectPage() {
  const { sector } = useSector();
  const [repo, setRepo] = useState("");
  const [name, setName] = useState("");
  const [spec, setSpec] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProjectLoadResult | null>(null);
  const [status, setStatus] = useState<ProjectStatus | null>(null);

  // Poll progress while PRs are being checked
  useEffect(() => {
    if (!result) return;
    let alive = true;
    const tick = async () => {
      const s = await getCurrentProject();
      if (!alive) return;
      setStatus(s);
      if (s && (s.status === "ready" || s.status === "error")) return;
      setTimeout(tick, 1500);
    };
    tick();
    return () => {
      alive = false;
    };
  }, [result]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repo.trim()) return setError("Add the GitHub repo.");
    setBusy(true);
    setError(null);
    setResult(null);
    setStatus({ name: name || repo, repo, spec_source: "pasted spec", sector, status: "loading", progress: { step: "spec" } });
    try {
      setResult(await loadProject({ name: name.trim() || undefined, repo_url: repo.trim(), spec, sector }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the project");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  const step = status?.progress?.step ?? (result ? "prs" : "spec");
  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.key === step));
  const started = busy || result;

  return (
    <div className="space-y-8">
      <BackLink />
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-50">Load a project</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Point DeltaZero at a GitHub repo and paste the requirements. It turns them into a checklist, uses the repo&rsquo;s GitHub Issues as
          tickets, and checks every pull request that closes one of them. After that, every new push is checked automatically.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={submit} className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-100">GitHub repo</span>
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className={`${input} mt-1.5 w-full px-3 py-2.5 placeholder:text-slate-500`}
              disabled={busy}
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-100">
              Requirements
            </span>
            <textarea
              value={spec}
              onChange={(e) => setSpec(e.target.value)}
              rows={9}
              placeholder={"Paste the client brief, spec or feature list. One requirement per line works best."}
              required
              className={`${input} mt-1.5 w-full px-3 py-2.5 leading-6 placeholder:text-slate-500`}
              disabled={busy}
            />
          </label>

          <div className="flex flex-wrap gap-4">
            <label className="block">
              <span className="text-sm font-medium text-slate-100">Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Defaults to the repo name"
                className={`${input} mt-1.5 block w-64 px-3 py-2 placeholder:text-slate-500`}
                disabled={busy}
              />
            </label>
          </div>

          {error && <p className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">{error}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy || !repo.trim() || !spec.trim()} className={btnPrimary}>
              {busy ? "Loading…" : "Load and start tracking"}
            </button>
            <span className="text-xs text-slate-400">Replaces the project currently on the dashboard.</span>
          </div>
        </form>

        {/* Progress */}
        <aside className={`${card} h-fit p-5`} aria-live="polite">
          <p className={eyebrow}>{started ? status?.repo || repo : "What happens"}</p>
          <ol className="mt-4 space-y-4">
            {STEPS.map((s, i) => {
              const done = started && (i < stepIndex || status?.status === "ready");
              const active = started && i === stepIndex && status?.status !== "ready";
              return (
                <li key={s.key} className="flex gap-3">
                  <span
                    className={
                      "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold " +
                      (done
                        ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-200"
                        : active
                          ? "animate-pulse border-cyan-300/60 bg-cyan-400/15 text-cyan-100"
                          : "border-navy-600 text-slate-500")
                    }
                    aria-hidden
                  >
                    {done ? <Icon name="check" className="h-3 w-3" /> : i + 1}
                  </span>
                  <div>
                    <p className={`text-sm font-medium ${done || active ? "text-slate-100" : "text-slate-400"}`}>
                      {s.label}
                      {active && s.key === "prs" && status?.progress?.total ? ` (${status.progress.done ?? 0}/${status.progress.total})` : ""}
                    </p>
                    <p className="text-xs text-slate-400">{s.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>

          {result && (
            <div className="mt-5 space-y-1 border-t border-navy-700 pt-4 text-sm text-slate-300">
              <p>
                <span className="font-semibold text-slate-100">{result.requirements}</span> requirements
              </p>
              <p>
                <span className="font-semibold text-slate-100">{result.tickets}</span> GitHub issues as tickets
              </p>
              <p>
                <span className="font-semibold text-rose-200">{result.lost}</span> lost (no matching issue)
              </p>
              <p>
                <span className="font-semibold text-slate-100">{result.prs_to_check}</span> pull requests to look at
              </p>
              {status?.status === "ready" && (
                <p className="pt-1 text-xs text-slate-400">
                  Checked {status.progress.checked ?? 0}. {status.progress.skipped?.length ? `${status.progress.skipped.length} skipped (not linked to an issue with requirements).` : ""}
                </p>
              )}
            </div>
          )}

          {result && (
            <Link href="/" className={`${btnPrimary} mt-5 block text-center`}>
              {status?.status === "ready" ? "Open dashboard" : "Open dashboard (keeps updating)"}
            </Link>
          )}
        </aside>
      </div>
    </div>
  );
}
