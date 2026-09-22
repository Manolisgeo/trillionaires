import { describe, expect, it } from "vitest";
import {
  createInitialState,
  questionsCoveredByUtterance,
  scoreSegment,
  selectNextAction,
} from "@aperture/conversation";
import type { ConversationState, Question } from "@aperture/types";

function state(partial: Partial<ConversationState> = {}): ConversationState {
  return {
    ...createInitialState({
      conversationId: "eval",
      purpose: "Evaluate backend engineering ability.",
      objectives: [
        {
          id: "backend",
          title: "Backend engineering ability",
          description: "Systems, data, production",
          importance: 0.95,
          status: "UNCOVERED",
          evidenceIds: [],
        },
      ],
      participants: [
        { id: "human", displayName: "Alex", role: "PARTICIPANT", isAgent: false },
        { id: "agent", displayName: "Aperture", role: "AI_AGENT", isAgent: true },
      ],
    }),
    conversationTimeSeconds: 30,
    ...partial,
  };
}

const questions: Question[] = [
  {
    id: "q1",
    prompt: "Tell me about a system you designed.",
    objectiveId: "backend",
    expectedEvidence: ["designed", "service", "postgres"],
    importance: 0.9,
    difficulty: 0.4,
    prerequisites: [],
    followUpIds: ["q2"],
    status: "PLANNED",
  },
  {
    id: "q2",
    prompt: "How did it fail in production?",
    objectiveId: "backend",
    expectedEvidence: ["incident", "recovery"],
    importance: 0.85,
    difficulty: 0.5,
    prerequisites: [],
    followUpIds: [],
    status: "PLANNED",
  },
];

describe("evals", () => {
  it("cooperative: one rich answer can cover multiple planned questions", () => {
    const covered = questionsCoveredByUtterance(
      questions,
      "I designed a distributed service on Postgres and later handled a production incident with a recovery plan.",
    );
    expect(covered).toEqual(expect.arrayContaining(["q1", "q2"]));
  });

  it("verbose: still follows up rather than wrapping immediately", () => {
    const action = selectNextAction(
      state({
        recentTranscript: [
          {
            id: "s",
            speakerId: "human",
            speakerName: "Alex",
            text: "So at my last company ".repeat(80),
            startTime: 10,
            endTime: 40,
            confidence: 1,
            isFinal: true,
          },
        ],
      }),
      questions,
    );
    expect(["FOLLOW_UP", "ASK_QUESTION", "CLARIFY"]).toContain(action.type);
  });

  it("short answers: clarify instead of accepting emptiness", () => {
    const action = selectNextAction(
      state({
        recentTranscript: [
          {
            id: "s",
            speakerId: "human",
            speakerName: "Alex",
            text: "I did various stuff I think.",
            startTime: 12,
            endTime: 14,
            confidence: 1,
            isFinal: true,
          },
        ],
      }),
      questions,
    );
    expect(action.type).toBe("CLARIFY");
  });

  it("unexpected question: answer the human first", () => {
    const action = selectNextAction(
      state({
        recentTranscript: [
          {
            id: "s",
            speakerId: "human",
            speakerName: "Alex",
            text: "Can you tell me what success looks like for this conversation?",
            startTime: 8,
            endTime: 11,
            confidence: 1,
            isFinal: true,
          },
        ],
      }),
      questions,
    );
    expect(action.type).toBe("ANSWER");
  });

  it("topic change: strategy can skip questions already evidenced", () => {
    const remaining = questions.map((q) =>
      q.id === "q1" ? { ...q, status: "SKIPPED" as const } : q,
    );
    const action = selectNextAction(
      state({
        importantFacts: [
          {
            id: "f",
            text: "Designed a service on postgres",
            kind: "FACT",
            evidenceSegmentIds: [],
            objectiveIds: ["backend"],
            confidence: 0.9,
            createdAt: new Date().toISOString(),
          },
        ],
        recentTranscript: [
          {
            id: "s",
            speakerId: "human",
            speakerName: "Alex",
            text: "Anyway, the interesting part was the on-call rotation.",
            startTime: 40,
            endTime: 44,
            confidence: 1,
            isFinal: true,
          },
        ],
      }),
      remaining,
    );
    expect(action.questionId === "q1").toBe(false);
  });

  it("contradictions: follow up", () => {
    const action = selectNextAction(
      state({
        detectedContradictions: [
          {
            id: "c",
            summary: "Consistency",
            statementA: "strongly consistent",
            statementB: "eventually consistent",
            segmentIds: [],
            resolved: false,
          },
        ],
        recentTranscript: [
          {
            id: "s",
            speakerId: "human",
            speakerName: "Alex",
            text: "It was eventually consistent.",
            startTime: 50,
            endTime: 52,
            confidence: 1,
            isFinal: true,
          },
        ],
      }),
      questions,
    );
    expect(action.type).toBe("FOLLOW_UP");
  });

  it("filler / noise is low-value, not deleted", () => {
    const scored = scoreSegment(
      { text: "um yeah" },
      { purpose: "backend", objectiveTitles: ["Backend"] },
    );
    expect(scored.category).toBe("LOW_VALUE");
  });

  it("long pause opening still starts the conversation", () => {
    const action = selectNextAction(state({ conversationTimeSeconds: 3, recentTranscript: [] }), questions);
    expect(action.type).toBe("ASK_QUESTION");
  });

  it("interruption events are represented as a first-class next-step concern, not a script lock", () => {
    const action = selectNextAction(
      state({
        agentMode: "SPEAKING",
        recentTranscript: [
          {
            id: "s",
            speakerId: "human",
            speakerName: "Alex",
            text: "Wait, can you repeat the question?",
            startTime: 20,
            endTime: 21,
            confidence: 1,
            isFinal: true,
          },
        ],
      }),
      questions,
    );
    expect(action.type).toBe("ANSWER");
  });
});
