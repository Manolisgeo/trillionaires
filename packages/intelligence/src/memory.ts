import type { ConversationState } from "@aperture/types";
import type { ExtractedClaim } from "./claims";

export type MemoryLayers = {
  /** Last ~90 seconds. What the realtime model should see. */
  l0: ConversationState["recentTranscript"];
  /** This conversation: facts, open objectives, contradictions. */
  l1: {
    facts: string[];
    contradictions: string[];
    uncoveredObjectives: string[];
    openQuestions: string[];
  };
};

export function conversationMemory(state: ConversationState): MemoryLayers {
  const now = state.conversationTimeSeconds;
  return {
    l0: state.recentTranscript.filter((segment) => now - segment.endTime <= 90),
    l1: {
      facts: state.importantFacts.map((fact) => fact.text),
      contradictions: state.detectedContradictions
        .filter((item) => !item.resolved)
        .map((item) => item.summary),
      uncoveredObjectives: state.uncoveredObjectives,
      openQuestions: state.unresolvedQuestions
        .filter((question) => question.status !== "ANSWERED" && question.status !== "SKIPPED")
        .map((question) => question.prompt),
    },
  };
}

export type PersonMemory = {
  topics: Array<{ topic: string; claims: ExtractedClaim[] }>;
};

/** Claims learned about one person, grouped by topic. Cross-conversation when the caller passes them all. */
export function personMemory(claims: ExtractedClaim[]): PersonMemory {
  const topics: PersonMemory["topics"] = [];
  for (const claim of claims) {
    const bucket = topics.find((item) => item.topic === claim.topic);
    if (bucket) bucket.claims.push(claim);
    else topics.push({ topic: claim.topic, claims: [claim] });
  }
  return { topics };
}
