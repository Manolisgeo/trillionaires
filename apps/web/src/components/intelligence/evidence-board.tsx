import { formatTimestamp } from "@/lib/time";

export type EvidenceClaim = {
  id: string;
  topic: string;
  observation: string;
  interpretation: string;
  confidence: string;
  speakerName: string;
  evidence: Array<{
    id: string;
    role: string;
    speakerName: string;
    quote: string;
    startTime: number;
  }>;
};

export function EvidenceBoard({
  claims,
  onSeek,
}: {
  claims: EvidenceClaim[];
  onSeek?: (seconds: number) => void;
}) {
  if (claims.length === 0) {
    return (
      <p className="text-sm text-muted">
        Claims appear after the conversation is analyzed. Each one keeps the quote separate from the interpretation.
      </p>
    );
  }

  const topics = new Map<string, EvidenceClaim[]>();
  for (const claim of claims) {
    const list = topics.get(claim.topic) ?? [];
    list.push(claim);
    topics.set(claim.topic, list);
  }

  return (
    <div className="space-y-10">
      {[...topics.entries()].map(([topic, items]) => (
        <section key={topic}>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{topic}</h2>
          <ul className="mt-4 space-y-4">
            {items.map((claim) => (
              <li key={claim.id} className="rounded-xl border border-line bg-white p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium leading-6">{claim.observation}</p>
                  <span className="text-[11px] uppercase tracking-wide text-muted">{claim.confidence}</span>
                </div>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-accent">Why?</summary>
                  <div className="mt-3 space-y-3 text-sm leading-6">
                    <p>
                      <span className="text-muted">Interpretation. </span>
                      {claim.interpretation}
                    </p>
                    {claim.evidence.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="block text-left"
                        onClick={() => onSeek?.(item.startTime)}
                      >
                        <span className="font-mono text-xs text-muted">
                          {item.role === "COUNTER" ? "Counterevidence" : "Evidence"} ·{" "}
                          {formatTimestamp(item.startTime)} · {item.speakerName}
                        </span>
                        <p className="mt-1">“{item.quote}”</p>
                      </button>
                    ))}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
