import type { Evidence } from "@/lib/types";

export function EvidenceBlock({ ev, verified }: { ev: Evidence; verified: boolean }) {
  const lines = ev.code.split("\n");
  return (
    <div className={`overflow-hidden rounded-lg border ${verified ? "border-slate-200" : "border-rose-300"}`}>
      <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5 font-mono text-xs text-slate-600">
        <span>
          {ev.file}:{ev.start_line}–{ev.end_line}
        </span>
        {verified ? (
          <span className="font-sans font-medium text-emerald-700">✓ found in diff</span>
        ) : (
          <span className="font-sans font-medium text-rose-700">✕ not found in diff</span>
        )}
      </div>
      <pre className="overflow-x-auto bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100">
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="mr-4 w-8 shrink-0 select-none text-right text-slate-500">{ev.start_line + i}</span>
            <span className="whitespace-pre">{line}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

export function DiffBlock({ diff }: { diff: string }) {
  return (
    <pre className="overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-xs leading-5">
      {diff.split("\n").map((line, i) => {
        let cls = "text-slate-300";
        if (line.startsWith("+++") || line.startsWith("---")) cls = "text-slate-400";
        else if (line.startsWith("+")) cls = "bg-emerald-950/60 text-emerald-300";
        else if (line.startsWith("-")) cls = "bg-rose-950/60 text-rose-300";
        else if (line.startsWith("@@")) cls = "text-sky-400";
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
    <pre className="overflow-x-auto whitespace-pre rounded-lg bg-slate-950 p-3 font-mono text-xs leading-5 text-slate-100">
      {code}
    </pre>
  );
}
