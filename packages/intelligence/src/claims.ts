import { detectContradictions } from "@kimma/conversation";
import type { Fact } from "@kimma/types";

export type ClaimConfidence = "DIRECT" | "REPEATED" | "CORROBORATED" | "CONTRADICTED" | "UNKNOWN";

export type ClaimEvidence = {
  role: "SUPPORT" | "COUNTER";
  speakerName: string;
  quote: string;
  startTime: number;
  endTime?: number;
};

export type ExtractedClaim = {
  topic: string;
  observation: string;
  interpretation: string;
  confidence: ClaimConfidence;
  speakerName: string;
  evidence: ClaimEvidence[];
};

export type ClaimLine = {
  speakerName: string;
  text: string;
  startTime: number;
  endTime?: number;
  isAgent?: boolean;
};

const CLAIM_RE =
  /\b(i|we)\s+(designed|built|managed|led|owned|raised|shipped|migrated|operated|wrote|ran|hired)\b/i;
const SIGNAL_RE = /\b(strongly consistent|eventual(?:ly)? consistent|individual contributor)\b/i;

export function extractClaims(
  lines: ClaimLine[],
  topics: Array<string | { title: string; text?: string }>,
): ExtractedClaim[] {
  const spoken = lines.filter((line) => !line.isAgent && !/kimma/i.test(line.speakerName));
  const claims: ExtractedClaim[] = [];

  for (const line of spoken) {
    for (const sentence of sentences(line.text)) {
      if (!isClaim(sentence)) continue;
      claims.push({
        topic: matchTopic(sentence, topics),
        observation: sentence,
        interpretation: `${line.speakerName} said this. It is a record of the statement, not a verified fact.`,
        confidence: "DIRECT",
        speakerName: line.speakerName,
        evidence: [
          {
            role: "SUPPORT",
            speakerName: line.speakerName,
            quote: sentence,
            startTime: line.startTime,
            endTime: line.endTime,
          },
        ],
      });
    }
  }

  return flagContradictions(collapseRepeats(claims));
}

function isClaim(sentence: string): boolean {
  const words = sentence.split(/\s+/).filter(Boolean);
  return words.length >= 6 && (CLAIM_RE.test(sentence) || SIGNAL_RE.test(sentence) || /\d/.test(sentence));
}

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function matchTopic(sentence: string, topics: Array<string | { title: string; text?: string }>): string {
  const hay = sentence.toLowerCase();
  let best = "General";
  let bestScore = 0;
  for (const topic of topics) {
    const title = typeof topic === "string" ? topic : topic.title;
    const text = typeof topic === "string" ? topic : `${topic.title} ${topic.text ?? ""}`;
    const score = text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((term) => term.length > 3 && hay.includes(term)).length;
    if (score > bestScore) {
      best = title;
      bestScore = score;
    }
  }
  return best;
}

function collapseRepeats(claims: ExtractedClaim[]): ExtractedClaim[] {
  const kept: ExtractedClaim[] = [];
  for (const claim of claims) {
    const prior = kept.find(
      (item) => item.speakerName === claim.speakerName && item.topic === claim.topic && sameWords(item.observation, claim.observation),
    );
    if (!prior) {
      kept.push(claim);
      continue;
    }
    prior.evidence.push(...claim.evidence);
    prior.confidence = "REPEATED";
    prior.interpretation = `${claim.speakerName} repeated this topic. Repetition is not independent confirmation.`;
  }
  return kept;
}

function sameWords(a: string, b: string): boolean {
  const left = new Set(contentWords(a));
  const right = contentWords(b);
  if (left.size === 0 || right.length === 0) return false;
  const shared = right.filter((word) => left.has(word)).length;
  return shared / Math.max(left.size, right.length) >= 0.6;
}

function contentWords(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 3);
}

function flagContradictions(claims: ExtractedClaim[]): ExtractedClaim[] {
  const facts: Fact[] = claims.map((claim, index) => ({
    id: String(index),
    text: claim.observation,
    kind: "FACT",
    evidenceSegmentIds: [],
    objectiveIds: [],
    confidence: 0.5,
    createdAt: new Date(0).toISOString(),
  }));
  const conflicts = detectContradictions(facts);
  for (const conflict of conflicts) {
    const left = claims.find((claim) => claim.observation.includes(conflict.statementA) || conflict.statementA.includes(claim.observation.slice(0, 40)));
    const right = claims.find((claim) => claim !== left && (claim.observation.includes(conflict.statementB) || conflict.statementB.includes(claim.observation.slice(0, 40))));
    if (!left || !right) continue;
    markConflict(left, right);
    markConflict(right, left);
  }
  return claims;
}

function markConflict(claim: ExtractedClaim, other: ExtractedClaim): void {
  claim.confidence = "CONTRADICTED";
  claim.interpretation =
    "Potential contradiction. The other statement is attached as counterevidence. Neither statement is selected as the true one.";
  const quote = other.evidence[0];
  if (!quote) return;
  if (claim.evidence.some((item) => item.role === "COUNTER" && item.quote === quote.quote)) return;
  claim.evidence.push({ ...quote, role: "COUNTER" });
}
