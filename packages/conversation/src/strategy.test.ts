import { createInitialState } from "./state";
import { detectContradictions } from "./intelligence";
import { questionsCoveredByUtterance, selectNextAction } from "./strategy";
import { scoreSegment } from "./importance";
import type { ConversationState, Question } from "@aperture/types";
import { describe, expect, it } from "vitest";

function sampleState(overrides: Partial<ConversationState> = {}): ConversationState {
  const base = createInitialState({
    conversationId: "c1",
    purpose: "Evaluate backend engineering ability.",
    objectives: [
      {
        id: "obj-backend",
        title: "Backend engineering ability",
        description: "Design and operate backend systems",
        importance: 0.95,
        status: "UNCOVERED",
        evidenceIds: [],
      },
      {
        id: "obj-failure",
        title: "Failure recovery",
        description: "Incident experience",
        importance: 0.85,
        status: "UNCOVERED",
        evidenceIds: [],
      },
    ],
    participants: [
      { id: "human", displayName: "Alex", role: "PARTICIPANT", isAgent: false },
      { id: "agent", displayName: "Aperture", role: "AI_AGENT", isAgent: true },
    ],
  });
  return { ...base, ...overrides };
}

const questions: Question[] = [
  {
    id: "q-pg",
    prompt: "What databases have you operated in production?",
    objectiveId: "obj-backend",
    expectedEvidence: ["postgresql", "postgres"],
    importance: 0.7,
    difficulty: 0.3,
    prerequisites: [],
    followUpIds: [],
    status: "PLANNED",
  },
  {
    id: "q-fail",
    prompt: "Tell me about a production failure.",
    objectiveId: "obj-failure",
    expectedEvidence: ["incident", "recovery"],
    importance: 0.88,
    difficulty: 0.5,
    prerequisites: [],
    followUpIds: [],
    status: "PLANNED",
  },
];

describe("question strategy", () => {
  it("skips planned questions already answered in one utterance", () => {
    const covered = questionsCoveredByUtterance(
      questions,
      "I have operated PostgreSQL in production for five years.",
    );
    expect(covered).toContain("q-pg");
    expect(covered).not.toContain("q-fail");
  });

  it("clarifies vague answers instead of advancing the script", () => {
    const state = sampleState({
      conversationTimeSeconds: 40,
      recentTranscript: [
        {
          id: "s1",
          speakerId: "human",
          speakerName: "Alex",
          text: "I did a lot of stuff with various backend things, kind of.",
          startTime: 10,
          endTime: 18,
          confidence: 0.9,
          isFinal: true,
        },
      ],
    });
    const action = selectNextAction(state, questions);
    expect(action.type).toBe("CLARIFY");
  });

  it("answers when the participant asks a question", () => {
    const state = sampleState({
      conversationTimeSeconds: 20,
      recentTranscript: [
        {
          id: "s1",
          speakerId: "human",
          speakerName: "Alex",
          text: "What are you evaluating me on?",
          startTime: 12,
          endTime: 14,
          confidence: 0.9,
          isFinal: true,
        },
      ],
    });
    expect(selectNextAction(state, questions).type).toBe("ANSWER");
  });

  it("follows up on unresolved contradictions", () => {
    const state = sampleState({
      conversationTimeSeconds: 90,
      detectedContradictions: [
        {
          id: "c1",
          summary: "Consistency model",
          statementA: "The service was strongly consistent.",
          statementB: "We used eventual consistency.",
          segmentIds: [],
          resolved: false,
        },
      ],
      recentTranscript: [
        {
          id: "s1",
          speakerId: "human",
          speakerName: "Alex",
          text: "We used eventual consistency for the catalog.",
          startTime: 80,
          endTime: 84,
          confidence: 0.9,
          isFinal: true,
        },
      ],
    });
    const action = selectNextAction(state, questions);
    expect(action.type).toBe("CHALLENGE");
    expect(action.prompt).toMatch(/strongly consistent/i);
  });
});

describe("importance", () => {
  it("ranks concrete technical claims above filler", () => {
    const fact = scoreSegment(
      { text: "The service handled 100k requests per second on Postgres." },
      { purpose: "backend", objectiveTitles: ["Backend engineering ability"] },
    );
    const filler = scoreSegment(
      { text: "Yeah." },
      { purpose: "backend", objectiveTitles: ["Backend engineering ability"] },
    );
    expect(fact.category).toBe("KEY_FACT");
    expect(fact.importanceScore).toBeGreaterThan(filler.importanceScore);
    expect(filler.category).toBe("LOW_VALUE");
  });
});

describe("contradictions", () => {
  it("detects consistency-model conflicts", () => {
    const found = detectContradictions([
      {
        id: "1",
        text: "The service was strongly consistent.",
        kind: "FACT",
        evidenceSegmentIds: [],
        objectiveIds: [],
        confidence: 0.8,
        createdAt: new Date().toISOString(),
      },
      {
        id: "2",
        text: "Later we described it as eventually consistent.",
        kind: "FACT",
        evidenceSegmentIds: [],
        objectiveIds: [],
        confidence: 0.8,
        createdAt: new Date().toISOString(),
      },
    ]);
    expect(found.length).toBeGreaterThan(0);
  });
});
