export type ScoreQuote = { speakerName: string; text: string; startTime: number };

export type EvidenceBundle = {
  confidence: string;
  observation: string;
  interpretation: string;
  support: ScoreQuote[];
  counter: ScoreQuote[];
};

export function asEvidence(value: unknown): EvidenceBundle {
  if (Array.isArray(value)) {
    return {
      confidence: "UNKNOWN",
      observation: "",
      interpretation: "",
      support: asQuotes(value),
      counter: [],
    };
  }
  if (!value || typeof value !== "object") {
    return { confidence: "UNKNOWN", observation: "", interpretation: "", support: [], counter: [] };
  }
  const row = value as Record<string, unknown>;
  return {
    confidence: typeof row.confidence === "string" ? row.confidence : "UNKNOWN",
    observation: typeof row.observation === "string" ? row.observation : "",
    interpretation: typeof row.interpretation === "string" ? row.interpretation : "",
    support: asQuotes(row.support ?? row.quotes),
    counter: asQuotes(row.counter),
  };
}

export function evidenceFields(value: unknown, rationale: string) {
  const bundle = asEvidence(value);
  const support = bundle.support.length > 0 ? bundle.support : asQuotes(value);
  return {
    confidence: bundle.confidence,
    observation: bundle.observation,
    interpretation: bundle.interpretation || rationale,
    quotes: support,
    counterQuotes: bundle.counter,
  };
}

export function asQuotes(value: unknown): ScoreQuote[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as { speakerName?: unknown; text?: unknown; startTime?: unknown };
    if (typeof row.speakerName !== "string" || typeof row.text !== "string") return [];
    return [
      {
        speakerName: row.speakerName,
        text: row.text,
        startTime: typeof row.startTime === "number" ? row.startTime : 0,
      },
    ];
  });
}
