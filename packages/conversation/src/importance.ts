import type { ImportanceCategory, TranscriptSegment } from "@aperture/types";

const DECISION_RE = /\b(we (will|should|decided|agreed)|let'?s go with|decision is)\b/i;
const ACTION_RE = /\b(i'?ll |we'?ll |follow up|action item|send|schedule|next step)\b/i;
const QUESTION_RE = /\?$|\b(how|what|why|when|where|who|can you)\b/i;
const CONCERN_RE = /\b(worried|risk|blocker|concern|issue|problem|unsure)\b/i;
const CONTRADICTION_HINT = /\b(actually|wait|i misspoke|correction|on second thought)\b/i;
const FACT_RE =
  /\b(\d+(\.\d+)?\s?(k|m|%|ms|qps|rps)|postgres|kubernetes|distributed|latency|revenue|customers?)\b/i;

export interface ImportanceResult {
  importanceScore: number;
  importanceReason: string;
  category: ImportanceCategory;
}

export function scoreSegment(
  segment: Pick<TranscriptSegment, "text">,
  context: { purpose: string; objectiveTitles: string[] },
): ImportanceResult {
  const text = segment.text.trim();
  if (!text) {
    return {
      importanceScore: 0,
      importanceReason: "Empty utterance",
      category: "LOW_VALUE",
    };
  }

  if (CONTRADICTION_HINT.test(text)) {
    return {
      importanceScore: 0.92,
      importanceReason: "Speaker revised or contradicted a prior statement",
      category: "CONTRADICTION",
    };
  }
  if (DECISION_RE.test(text)) {
    return {
      importanceScore: 0.9,
      importanceReason: "Contains a decision",
      category: "DECISION",
    };
  }
  if (ACTION_RE.test(text)) {
    return {
      importanceScore: 0.78,
      importanceReason: "Contains an action or commitment",
      category: "ACTION",
    };
  }
  if (CONCERN_RE.test(text)) {
    return {
      importanceScore: 0.8,
      importanceReason: "Raises a concern or risk",
      category: "CONCERN",
    };
  }
  if (text.endsWith("?") || (QUESTION_RE.test(text) && text.length < 180)) {
    return {
      importanceScore: 0.62,
      importanceReason: "Contains a question",
      category: "QUESTION",
    };
  }

  const objectiveHit = context.objectiveTitles.some((title) =>
    text.toLowerCase().includes(title.toLowerCase().slice(0, 18)),
  );
  if (FACT_RE.test(text) || objectiveHit) {
    return {
      importanceScore: objectiveHit ? 0.86 : 0.74,
      importanceReason: objectiveHit
        ? "Directly relevant to a conversation objective"
        : "Contains a concrete claim or metric",
      category: "KEY_FACT",
    };
  }

  if (text.split(/\s+/).length < 4) {
    return {
      importanceScore: 0.12,
      importanceReason: "Backchannel or filler",
      category: "LOW_VALUE",
    };
  }

  return {
    importanceScore: 0.35,
    importanceReason: "Background discussion",
    category: "BACKGROUND",
  };
}

export function matchesFilter(
  category: ImportanceCategory | undefined,
  filter: string,
): boolean {
  if (filter === "EVERYTHING" || !category) return true;
  if (filter === "IMPORTANT") {
    return ![ "LOW_VALUE", "BACKGROUND"].includes(category);
  }
  const map: Record<string, ImportanceCategory[]> = {
    DECISIONS: ["DECISION"],
    ACTIONS: ["ACTION"],
    QUESTIONS: ["QUESTION"],
    CONCERNS: ["CONCERN"],
    CONTRADICTIONS: ["CONTRADICTION"],
  };
  return map[filter]?.includes(category) ?? true;
}
