import type { Evidence } from "@/lib/types";

export function EvidenceBlock({ ev, verified }: { ev: Evidence; verified: boolean }) {
  const lines = ev.code.split("\n");
  return (
    <div className={`overflow-hidden rounded-lg border ${verified ? "border-navy-700" : "border-rose-400/40"}`}>
      <div className="flex items-center justify-between border-b border-navy-700 bg-navy-850 px-3 py-1.5 font-mono text-xs text-slate-400">
        <span>
          {ev.file}:{ev.start_line}–{ev.end_line}
        </span>
        {verified ? (
          <span className="font-sans font-medium text-emerald-300">✓ found in diff</span>
        ) : (
          <span className="font-sans font-medium text-rose-300">✕ not found in diff</span>
        )}
      </div>
      <pre className="overflow-x-auto bg-navy-950 p-3 font-mono text-xs leading-5 text-slate-200">
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="mr-4 w-8 shrink-0 select-none text-right text-slate-600">{ev.start_line + i}</span>
            <span className="whitespace-pre">{line}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

export function DiffBlock({ diff }: { diff: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-navy-700 bg-navy-950 p-3 font-mono text-xs leading-5">
      {diff.split("\n").map((line, i) => {
        let cls = "text-slate-300";
        if (line.startsWith("+++") || line.startsWith("---")) cls = "text-slate-500";
        else if (line.startsWith("+")) cls = "bg-emerald-400/10 text-emerald-200";
        else if (line.startsWith("-")) cls = "bg-rose-400/10 text-rose-200";
        else if (line.startsWith("@@")) cls = "text-cyan-300/80";
        return (
          <div key={i} className={`whitespace-pre px-1 ${cls}`}>
            {line || " "}
          </div>
        );
      })}
    </pre>
  );
}

export function PlainCode({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto whitespace-pre rounded-lg border border-navy-700 bg-navy-950 p-3 font-mono text-xs leading-5 text-slate-200">
      {code}
    </pre>
  );
}
