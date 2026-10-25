import type { CriterionScore, Interview, Candidate, Report, Role, RoleProfile, Segment } from "./types";
import { callStructured, isMockMode, modelFor, UNTRUSTED_RULE } from "./claude";
import { ScoreOutZ } from "./prep/schemas";
import { fixtureReport, fixtureRoleProfile, summarizeIntegrity } from "./prep/fixtures";

export const normalizeWs = (s: string): string => s.replace(/\s+/g, " ").trim();

interface RawCriterion {
  criterionId: string; rating: number | null; rationale: string; evidence: { quote: string; segmentId: string }[];
}

/**
 * One CriterionScore per competency and must-have skill, in rubric order. Every evidence quote must be a
 * whitespace-normalized substring of its segment; invalid quotes are dropped; a criterion with no valid evidence
 * gets rating null ("insufficient evidence"). Exported for tests.
 */
export function verifyAndFinalizeCriteria(raw: RawCriterion[], profile: RoleProfile, transcript: Segment[]): CriterionScore[] {
  const segs = new Map(transcript.map((s) => [s.id, s]));
  const byId = new Map(raw.map((r) => [r.criterionId, r]));
  const rubric = [
    ...profile.competencies.map((c) => ({ id: c.id, name: c.name, kind: "competency" as const })),
    ...profile.mustHave.map((s) => ({ id: s.id, name: s.name, kind: "skill" as const })),
  ];
  return rubric.map((c) => {
    const r = byId.get(c.id);
    const evidence = (r?.evidence ?? []).flatMap((e) => {
      const seg = segs.get(e.segmentId);
      const q = normalizeWs(e.quote);
      if (!seg || q.length < 8 || !normalizeWs(seg.text).includes(q)) return [];
      return [{ quote: q, segmentId: seg.id, t: seg.start }];
    });
    const rating = evidence.length && r?.rating != null ? (Math.min(3, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3) : null;
    const rationale = !r
      ? "Not assessed: insufficient evidence in the transcript."
      : evidence.length === 0 && r.evidence.length > 0
        ? "Insufficient evidence: the cited quotes could not be verified against the transcript."
        : r.rationale;
    return { criterionId: c.id, kind: c.kind, name: c.name, rating, rationale, evidence };
  });
}

const SYSTEM = `You score a completed AI-led job interview against a rubric. A human makes the final decision.
${UNTRUSTED_RULE}
Rules:
- Return exactly one criteria entry per competency and per must-have skill (criterionId = its id).
- rating: 1 = weak, 2 = ok, 3 = strong, using the criterion's BARS anchors; null when the transcript lacks evidence. Never guess; prefer null. Rating 4 is human-only.
- evidence: 1-3 items per rated criterion. quote MUST be an exact contiguous substring (under 30 words) of ONE candidate segment's text, copied character for character; segmentId is that segment's id in square brackets. Quotes that are not verbatim are discarded.
- rationale: 1-3 plain sentences explaining the rating by the evidence. Judge answers, not accent, fluency, speech pace, appearance or anything protected.
- recommendation: "advance" only if evidence clearly meets the bar on the heaviest criteria; otherwise "human_review". Never recommend rejection. recommendationReason: one or two sentences.
- strengths / concerns / openQuestions: short bullets (max 5 each). openQuestions are things a human should follow up on.
- Integrity signals are context only: do not let them change any rating.`;

const mmss = (t: number) => `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export async function scoreInterview(i: { interview: Interview; role: Role; candidate: Candidate }): Promise<Report> {
  const { interview, role } = i;
  if (isMockMode()) return fixtureReport(interview, role);
  const profile = role.profile ?? fixtureRoleProfile({ title: role.title, company: role.company });

  const rubric = {
    competencies: profile.competencies.map((c) => ({ id: c.id, name: c.name, description: c.description, weight: c.weight, anchors: c.anchors })),
    mustHaveSkills: profile.mustHave.map((s) => ({ id: s.id, name: s.name, weight: s.weight, evidenceHints: s.evidenceHints })),
  };
  const transcript = interview.transcript
    .map((s) => `[${s.id}] ${mmss(s.start)} ${s.speaker === "agent" ? "INTERVIEWER" : "CANDIDATE"}: ${s.text}`)
    .join("\n");
  const integrity = interview.integrity.map((s) => `${mmss(s.t)} ${s.kind}${s.detail ? ` (${s.detail})` : ""}`).join("\n") || "none";
  const text =
    `<rubric>\n${JSON.stringify(rubric)}\n</rubric>\n` +
    `<untrusted_transcript>\n${transcript || "(empty transcript)"}\n</untrusted_transcript>\n` +
    `<integrity_signals>\n${integrity}\n</integrity_signals>\n` +
    `Role: ${role.title}. Score the interview.`;
  const out = await callStructured({ kind: "scorer", system: SYSTEM, content: [{ type: "text", text }], schema: ScoreOutZ });

  return {
    summary: out.summary,
    recommendation: out.recommendation,
    recommendationReason: out.recommendationReason,
    criteria: verifyAndFinalizeCriteria(out.criteria, profile, interview.transcript),
    strengths: out.strengths, concerns: out.concerns, openQuestions: out.openQuestions,
    integrityNotes: summarizeIntegrity(interview),
    scorerModel: modelFor("scorer"),
    createdAt: new Date().toISOString(),
  };
}
