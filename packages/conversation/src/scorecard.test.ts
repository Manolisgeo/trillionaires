import { describe, expect, it } from "vitest";
import { answerFromTranscript, draftScorecard, matchTrackers, talkStats } from "./scorecard";

const lines = [
  {
    speakerName: "Jordan Hale",
    text: "I designed a catalog service on PostgreSQL. Peak was about 100,000 requests per second.",
    startTime: 28,
    endTime: 52,
    category: "KEY_FACT",
  },
  {
    speakerName: "Jordan Hale",
    text: "A replica fell behind. I misspoke earlier — that path was eventually consistent. I owned the postmortem.",
    startTime: 222,
    endTime: 258,
    category: "CONTRADICTION",
  },
  {
    speakerName: "Jordan Hale",
    text: "I'll send the postmortem and the load-test notes after this.",
    startTime: 1480,
    endTime: 1488,
    category: "ACTION",
  },
];

describe("talkStats", () => {
  it("splits speaking time by speaker", () => {
    const stats = talkStats(lines);
    expect(stats.speakers[0]?.name).toBe("Jordan Hale");
    expect(stats.durationSeconds).toBeGreaterThan(0);
    expect(stats.speakers[0]?.share).toBeCloseTo(1);
  });
});

describe("draftScorecard", () => {
  it("links a concrete system claim to evidence and refuses a 4", () => {
    const [rating] = draftScorecard(
      [
        {
          id: "backend",
          title: "Backend engineering ability",
          description: "Design PostgreSQL services and requests",
        },
      ],
      lines,
    );
    expect(rating?.score).toBeNull();
    expect(rating?.confidence).toBe("DIRECT");
    expect(rating?.evidenceKind).toBe("FACT");
    expect(rating?.quotes[0]?.text).toContain("PostgreSQL");
  });

  it("marks a contradicted ownership story as uncertainty", () => {
    const [rating] = draftScorecard(
      [
        {
          id: "own",
          title: "Production ownership",
          description: "Postmortem and incident ownership",
        },
      ],
      lines,
    );
    expect(rating?.score).toBeNull();
    expect(rating?.confidence).toBe("CONTRADICTED");
    expect(rating?.evidenceKind).toBe("UNCERTAINTY");
    expect(rating?.counterQuotes.length).toBeGreaterThan(0);
  });

  it("does not invent a rating when the transcript is silent", () => {
    const [rating] = draftScorecard(
      [{ id: "comp", title: "Compensation", description: "Salary expectations" }],
      lines,
    );
    expect(rating?.score).toBeNull();
    expect(rating?.quotes).toHaveLength(0);
  });
});

describe("matchTrackers", () => {
  it("finds metric and commitment phrases", () => {
    const hits = matchTrackers(
      [
        { id: "metrics", name: "Metrics", phrases: ["requests"] },
        { id: "commit", name: "Commitments", phrases: ["i'll send"] },
      ],
      lines,
    );
    expect(hits.map((hit) => hit.trackerId).sort()).toEqual(["commit", "metrics"]);
  });
});

describe("answerFromTranscript", () => {
  it("returns the quote or says the transcript does not answer", () => {
    const hit = answerFromTranscript("requests per second", lines);
    expect(hit.quotes[0]?.text).toContain("100,000");
    const miss = answerFromTranscript("favorite cuisine", lines);
    expect(miss.quotes).toHaveLength(0);
    expect(miss.answer).toMatch(/will not invent/i);
  });
});
