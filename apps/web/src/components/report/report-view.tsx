import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@aperture/ui";

const TIMESTAMP = /\[(\d{1,2}:\d{2})\]/g;

function secondsFromStamp(stamp: string): number {
  const [m, s] = stamp.split(":").map(Number);
  return (m ?? 0) * 60 + (s ?? 0);
}

const kindClass: Record<string, string> = {
  FACT: "border-accent/30 bg-accent/5 text-accent",
  INFERENCE: "border-line text-muted",
  UNCERTAINTY: "border-amber-200 bg-amber-50 text-amber-900",
};

export function ReportView({
  summary,
  sections,
  onSeek,
}: {
  summary: string | null;
  sections: Array<{ id: string; key: string; title: string; body: string; kind?: string | null }>;
  onSeek?: (seconds: number) => void;
}) {
  return (
    <article className="mx-auto max-w-3xl space-y-10">
      <div className="print:hidden flex flex-wrap gap-2 text-[11px] uppercase tracking-wide text-muted">
        <Badge className={kindClass.FACT}>FACT · transcript</Badge>
        <Badge className={kindClass.INFERENCE}>INFERENCE · interpretation</Badge>
        <Badge className={kindClass.UNCERTAINTY}>UNCERTAINTY · weak evidence</Badge>
      </div>
      {summary ? (
        <section>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Executive summary
          </h2>
          <p className="mt-3 text-lg leading-8">{summary}</p>
        </section>
      ) : null}
      {sections.map((section) => (
        <section key={section.id} id={section.key}>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
              {section.title}
            </h2>
            {section.kind ? (
              <Badge className={cn(kindClass[section.kind])}>{section.kind}</Badge>
            ) : null}
          </div>
          <div className="whitespace-pre-wrap text-sm leading-7 text-ink/90">
            {linkTimestamps(section.body, onSeek)}
          </div>
        </section>
      ))}
      <p className="text-xs leading-5 text-muted">
        Aperture produces evidence and assessment. Humans make irreversible decisions — hiring,
        purchasing, and research conclusions stay with you.
      </p>
    </article>
  );
}

function linkTimestamps(body: string, onSeek?: (seconds: number) => void): ReactNode {
  if (!onSeek) return body;
  const parts: ReactNode[] = [];
  let last = 0;
  const re = new RegExp(TIMESTAMP);
  let match = re.exec(body);
  let i = 0;
  while (match) {
    const start = match.index;
    parts.push(body.slice(last, start));
    const stamp = match[1] ?? "00:00";
    const seconds = secondsFromStamp(stamp);
    parts.push(
      <button
        key={`${stamp}-${i}`}
        type="button"
        className="font-mono text-accent underline-offset-2 hover:underline"
        onClick={() => onSeek(seconds)}
      >
        [{stamp}]
      </button>,
    );
    last = start + match[0].length;
    i += 1;
    match = re.exec(body);
  }
  parts.push(body.slice(last));
  return parts;
}
