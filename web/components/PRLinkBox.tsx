"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkPRLink } from "@/lib/api";
import { btnPrimary, input } from "@/lib/ui";

// Paste any GitHub PR link to check it right now. (With the GitHub App installed,
// new PRs and new pushes are checked automatically. This is the manual way in.)
export default function PRLinkBox({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { pr_id } = await checkPRLink(url);
      router.push(`/pr/${pr_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not check that PR");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className={compact ? "space-y-1.5" : "space-y-2"} data-tour="pr-link">
      {!compact && (
        <label htmlFor="pr-link" className="block text-sm font-medium text-slate-100">
          Check a pull request
        </label>
      )}
      <div className="flex gap-2">
        <input
          id="pr-link"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a GitHub PR link, e.g. github.com/org/repo/pull/12"
          aria-label="GitHub pull request link"
          className={`${input} min-w-0 flex-1 px-3 py-2 placeholder:text-slate-500`}
        />
        <button type="submit" disabled={busy || !url.trim()} className={btnPrimary + " !px-3"}>
          {busy ? "Checking…" : "Check"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-300">{error}</p>}
      {!compact && (
        <p className="text-xs text-slate-400">
          Once the DeltaZero GitHub App is installed on a repo, every new PR and every new push is checked automatically. No link needed.
        </p>
      )}
    </form>
  );
}
