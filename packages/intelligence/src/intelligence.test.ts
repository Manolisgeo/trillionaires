import { createInitialState } from "@kimma/conversation";
import { describe, expect, it } from "vitest";
import { decide } from "./controller";
import { extractClaims } from "./claims";
import { conversationMemory, personMemory } from "./memory";

describe("conversation controller", () => {
  it("challenges an unresolved contradiction without treating either statement as true", () => {
    const state = createInitialState({
      conversationId: "c1",
      purpose: "Understand the system.",
      objectives: [],
      participants: [{ id: "h", displayName: "Alex", role: "PARTICIPANT", isAgent: false }],
    });
    const decision = decide(
      {
        ...state,
        conversationTimeSeconds: 90,
        detectedContradictions: [
          {
            id: "x",
            summary: "Consistency",
            statementA: "The service was strongly consistent.",
            statementB: "We used eventual consistency.",
            segmentIds: [],
            resolved: false,
          },
        ],
        recentTranscript: [
          {
            id: "s",
            speakerId: "h",
            speakerName: "Alex",
            text: "We used eventual consistency for the catalog.",
            startTime: 70,
            endTime: 80,
            confidence: 1,
            isFinal: true,
          },
        ],
      },
      [],
    );
    expect(decision.action).toBe("CHALLENGE");
    expect(decision.next.rationale.toLowerCase()).toContain("do not decide");
  });

  it("listens when a long turn just ended", () => {
    const state = createInitialState({
      conversationId: "c1",
      purpose: "Understand the system.",
      objectives: [],
      participants: [],
    });
    const decision = decide(
      {
        ...state,
        conversationTimeSeconds: 40,
        recentTranscript: [
          {
            id: "s",
            speakerId: "h",
            speakerName: "Alex",
            text: "I designed the catalog service and split reads onto replicas while writes stayed on the primary for the whole migration window.",
            startTime: 10,
            endTime: 39,
            confidence: 1,
            isFinal: true,
          },
        ],
      },
      [],
    );
    expect(decision.action).toBe("LISTEN");
  });
});

describe("claims", () => {
  it("keeps both sides of a consistency conflict and does not pick one", () => {
    const claims = extractClaims(
      [
        {
          speakerName: "Jordan Hale",
          text: "I designed a catalog service on PostgreSQL. At the time I said it was strongly consistent because writes went to one primary.",
          startTime: 12,
          endTime: 40,
        },
        {
          speakerName: "Jordan Hale",
          text: "I misspoke earlier — that path was eventually consistent. I owned the postmortem.",
          startTime: 80,
          endTime: 100,
        },
      ],
      ["Backend engineering ability"],
    );
    const conflicted = claims.filter((claim) => claim.confidence === "CONTRADICTED");
    expect(conflicted.length).toBeGreaterThan(0);
    expect(conflicted[0]?.evidence.some((item) => item.role === "COUNTER")).toBe(true);
    expect(conflicted[0]?.interpretation.toLowerCase()).toContain("neither");
  });
});

describe("memory", () => {
  it("keeps the last 90 seconds separate from the rest of the conversation", () => {
    const state = createInitialState({
      conversationId: "c1",
      purpose: "Understand the system.",
      objectives: [{ id: "o1", title: "Ownership", description: "", importance: 1, status: "UNCOVERED", evidenceIds: [] }],
      participants: [],
    });
    const memory = conversationMemory({
      ...state,
      conversationTimeSeconds: 200,
      recentTranscript: [
        {
          id: "old",
          speakerId: "h",
          speakerName: "Alex",
          text: "Earlier point.",
          startTime: 10,
          endTime: 20,
          confidence: 1,
          isFinal: true,
        },
        {
          id: "new",
          speakerId: "h",
          speakerName: "Alex",
          text: "Just now.",
          startTime: 160,
          endTime: 170,
          confidence: 1,
          isFinal: true,
        },
      ],
    });
    expect(memory.l0.map((segment) => segment.id)).toEqual(["new"]);
    expect(memory.l1.uncoveredObjectives).toContain("o1");
  });

  it("groups a person's claims by topic", () => {
    const memory = personMemory([
      {
        topic: "Leadership",
        observation: "I managed the backend team.",
        interpretation: "Stated.",
        confidence: "DIRECT",
        speakerName: "Jordan",
        evidence: [],
      },
    ]);
    expect(memory.topics[0]?.topic).toBe("Leadership");
  });
});
