export type TranscriptLine = {
  speakerName: string;
  text: string;
  startTime: number;
  endTime?: number;
  category?: string | null;
};

export type TalkSpeaker = {
  name: string;
  seconds: number;
  share: number;
  turns: number;
};

export type TalkStats = {
  speakers: TalkSpeaker[];
  questions: number;
  durationSeconds: number;
};

const STOP = new Set(
  "a an the of to and or for in on with from that this is are was were be been being it its as at by we you they i our your their".split(
    " ",
  ),
);

export function talkStats(lines: TranscriptLine[]): TalkStats {
  const totals = new Map<string, { seconds: number; turns: number }>();
  let duration = 0;
  let questions = 0;

  for (const line of lines) {
    const span = Math.max(1, Math.round((line.endTime ?? line.startTime + 4) - line.startTime));
    duration += span;
    const row = totals.get(line.speakerName) ?? { seconds: 0, turns: 0 };
    row.seconds += span;
    row.turns += 1;
    totals.set(line.speakerName, row);
    if (line.text.includes("?")) questions += 1;
  }

  const speakers = [...totals.entries()]
    .map(([name, row]) => ({
      name,
      seconds: row.seconds,
      turns: row.turns,
      share: duration === 0 ? 0 : row.seconds / duration,
    }))
    .sort((a, b) => b.seconds - a.seconds);

  return { speakers, questions, durationSeconds: duration };
}

export type CriterionInput = {
  id: string;
  title: string;
  description: string;
};

export type EvidenceQuote = {
  speakerName: string;
  text: string;
  startTime: number;
};

export type EvidenceConfidence = "DIRECT" | "REPEATED" | "CORROBORATED" | "CONTRADICTED" | "UNKNOWN";

export type DraftRating = {
  criterionId: string;
  /** Drafts never assign 1–4. A person does. */
  score: null;
  confidence: EvidenceConfidence;
  observation: string;
  interpretation: string;
  rationale: string;
  evidenceKind: "FACT" | "INFERENCE" | "UNCERTAINTY";
  quotes: EvidenceQuote[];
  counterQuotes: EvidenceQuote[];
};

export function draftScorecard(criteria: CriterionInput[], lines: TranscriptLine[]): DraftRating[] {
  return criteria.map((criterion) => {
    const related = lines
      .map((line) => ({ line, score: overlap(criterion, line.text) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => a.line.startTime - b.line.startTime);

    const support = related.filter(({ line }) => line.category !== "CONTRADICTION");
    const counters = related.filter(({ line }) => line.category === "CONTRADICTION");
    const quotes = support.slice(0, 3).map(({ line }) => quoteOf(line));
    const counterQuotes = counters.slice(0, 2).map(({ line }) => quoteOf(line));
    const observation = quotes[0]?.text ?? counterQuotes[0]?.text ?? "";

    if (quotes.length === 0 && counterQuotes.length === 0) {
      return {
        criterionId: criterion.id,
        score: null,
        confidence: "UNKNOWN" as const,
        observation: "",
        interpretation: "Nothing in the transcript addresses this criterion.",
        rationale: "No verbatim evidence. No score is assigned.",
        evidenceKind: "UNCERTAINTY" as const,
        quotes: [],
        counterQuotes: [],
      };
    }

    if (counterQuotes.length > 0) {
      return {
        criterionId: criterion.id,
        score: null,
        confidence: "CONTRADICTED" as const,
        observation,
        interpretation:
          quotes.length > 0
            ? "Potential contradiction. Both statements stay attached. Aperture does not decide which one is true."
            : "A conflicting statement is attached. Aperture does not treat it as settled.",
        rationale: "Supporting and conflicting quotes are both on this criterion. A person has to assess them.",
        evidenceKind: "UNCERTAINTY" as const,
        quotes,
        counterQuotes,
      };
    }

    if (quotes.length >= 2) {
      return {
        criterionId: criterion.id,
        score: null,
        confidence: "REPEATED" as const,
        observation,
        interpretation: "The same topic was stated in more than one moment. That is repetition, not a rating.",
        rationale: "Repeated evidence. No automatic score.",
        evidenceKind: "FACT" as const,
        quotes,
        counterQuotes,
      };
    }

    return {
      criterionId: criterion.id,
      score: null,
      confidence: "DIRECT" as const,
      observation,
      interpretation: "One direct statement. It is evidence, not an assessment.",
      rationale: "Direct evidence. A person assigns the rating.",
      evidenceKind: "FACT" as const,
      quotes,
      counterQuotes,
    };
  });
}

function quoteOf(line: TranscriptLine): EvidenceQuote {
  return { speakerName: line.speakerName, text: line.text, startTime: line.startTime };
}

export type TrackerDefinition = {
  id: string;
  name: string;
  phrases: string[];
};

export type TrackerMatch = {
  trackerId: string;
  startTime: number;
  speakerName: string;
  excerpt: string;
};

export function matchTrackers(trackers: TrackerDefinition[], lines: TranscriptLine[]): TrackerMatch[] {
  const hits: TrackerMatch[] = [];
  for (const line of lines) {
    const text = line.text.toLowerCase();
    for (const tracker of trackers) {
      const phrase = tracker.phrases.find((item) => item && text.includes(item.toLowerCase()));
      if (!phrase) continue;
      hits.push({
        trackerId: tracker.id,
        startTime: line.startTime,
        speakerName: line.speakerName,
        excerpt: line.text,
      });
    }
  }
  return hits;
}

export function answerFromTranscript(
  question: string,
  lines: TranscriptLine[],
): { answer: string; quotes: EvidenceQuote[] } {
  const terms = tokens(question);
  if (terms.length === 0) {
    return { answer: "Ask about a claim, metric, person, or objection from this conversation.", quotes: [] };
  }

  const ranked = lines
    .map((line) => ({
      line,
      score: terms.filter((term) => line.text.toLowerCase().includes(term)).length,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.line.startTime - b.line.startTime)
    .slice(0, 3);

  if (ranked.length === 0) {
    return {
      answer: "Nothing in this transcript answers that. Aperture will not invent a claim.",
      quotes: [],
    };
  }

  const quotes = ranked.map(({ line }) => ({
    speakerName: line.speakerName,
    text: line.text,
    startTime: line.startTime,
  }));
  const first = quotes[0];
  return {
    answer: first
      ? `${first.speakerName} said this in the transcript. The rating, if any, is still a human decision.`
      : "Nothing in this transcript answers that.",
    quotes,
  };
}

export const builtinTrackerDefinitions: Array<{ name: string; description: string; phrases: string[] }> = [
  {
    name: "Metrics",
    description: "Numbers, latency, throughput, and other measurable claims.",
    phrases: ["percent", "latency", "requests", "qps", "p99", "million", "seconds"],
  },
  {
    name: "Incidents",
    description: "Production failures, postmortems, and recovery.",
    phrases: ["incident", "postmortem", "outage", "failure", "lag", "stale"],
  },
  {
    name: "Commitments",
    description: "A promise to send something or follow up.",
    phrases: ["i'll send", "i will send", "follow up", "i'll follow"],
  },
  {
    name: "Compensation",
    description: "Pay, equity, or an offer mentioned in the conversation.",
    phrases: ["salary", "compensation", "equity", "offer", "comp"],
  },
  {
    name: "Competing option",
    description: "Another vendor, offer, or path.",
    phrases: ["other offer", "competitor", "alternative", "evaluating"],
  },
  {
    name: "Decision process",
    description: "Who decides, and what has to happen next.",
    phrases: ["decision", "stakeholder", "approve", "budget", "timeline"],
  },
];

function overlap(criterion: CriterionInput, text: string): number {
  const wanted = tokens(`${criterion.title} ${criterion.description}`);
  if (wanted.length === 0) return 0;
  const hay = text.toLowerCase();
  return wanted.filter((term) => hay.includes(term)).length;
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter((term) => term.length > 2 && !STOP.has(term));
}
