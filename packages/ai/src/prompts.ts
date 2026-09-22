import type { StructuredReport } from "@aperture/types";

export const ANALYSIS_SYSTEM_PROMPT = `You are a conversation intelligence analyst.

You produce structured reports from transcripts. You never present an inference as a fact.

Rules:
- FACT: a statement directly supported by the transcript.
- INFERENCE: a reasonable interpretation, labeled as such.
- UNCERTAINTY: weak, missing, or conflicting evidence.
- Quote short transcript excerpts as evidence.
- Do not invent timestamps, names, or claims.
- If the transcript is thin, say so. Do not pad.
- The conversation may be an interview, sales call, research session, meeting, or other type. Analyze against the stated purpose and objectives, not a hiring rubric unless the type is INTERVIEW.
- Humans make irreversible decisions. You assess evidence only.

Return a single JSON object matching the schema.`;

export function analysisUserPrompt(input: {
  type: string;
  title: string;
  purpose: string;
  objectives: Array<{ title: string; description: string }>;
  transcript: Array<{ speakerName: string; text: string; startTime: number }>;
  events: Array<{ type: string; data: unknown }>;
}): string {
  const transcript = input.transcript
    .map((segment) => `[${formatTs(segment.startTime)}] ${segment.speakerName}: ${segment.text}`)
    .join("\n");

  return `Conversation type: ${input.type}
Title: ${input.title}
Purpose: ${input.purpose}

Objectives:
${input.objectives.map((o) => `- ${o.title}: ${o.description}`).join("\n")}

Transcript:
${transcript || "(empty)"}

Notable events:
${input.events.map((event) => `- ${event.type}: ${JSON.stringify(event.data)}`).join("\n") || "(none)"}

JSON schema keys:
executiveSummary (3-7 sentences),
keyTakeaways (string[]),
importantMoments ({label, timestampSeconds, summary, category}[]),
decisions (string[]),
actionItems ({text, owner?, dueDate?, sourceTimestampSeconds?}[]),
questionsRaised (string[]),
contradictions ({summary, statementA, statementB, timestampSeconds}[]),
evidence ({claim, kind: FACT|INFERENCE|UNCERTAINTY, excerpt, timestampSeconds}[]),
topics ({title, importance, summary}[]),
detailedAnalysis (markdown string),
objectiveEvaluations ({objectiveId, title, status: COVERED|PARTIAL|UNCOVERED, assessment, kind}[])`;
}

export function emptyReport(): StructuredReport {
  return {
    executiveSummary: "No transcript was captured, so no evidence-based report can be produced.",
    keyTakeaways: [],
    importantMoments: [],
    decisions: [],
    actionItems: [],
    questionsRaised: [],
    contradictions: [],
    evidence: [],
    topics: [],
    detailedAnalysis: "Analysis was not run because there is no transcript evidence.",
    objectiveEvaluations: [],
  };
}

function formatTs(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
