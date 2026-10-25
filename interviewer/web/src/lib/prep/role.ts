import type { RoleProfile } from "../types";
import { callStructured, isMockMode, UNTRUSTED_RULE } from "../claude";
import { RoleProfileZ } from "./schemas";
import { fixtureRoleProfile } from "./fixtures";

const SYSTEM = `You draft an interview rubric (role profile) from a job description for an AI interviewer. Recruiters will review and edit it.
${UNTRUSTED_RULE}
Rules:
- competencies: 4-6, named in O*NET / Great Eight style (e.g. Problem solving, Communication, Ownership and initiative). weight 1-5.
- anchors (BARS): weak / ok / strong must be concrete, observable behaviours a transcript could show, not adjectives.
- coreQuestions: 3-5 STAR behavioral questions, every candidate gets the same ones; each tied to one competencyId; 1-3 follow-ups that push for "what did you do" and "what was the result".
- mustHave / niceToHave: skills from the JD only (do not invent requirements); weight 1-5; evidenceHints say what a good answer or CV line would show.
- technicalTopics: 2-5, difficulty matched to the level; probes are discussion questions (no code execution).
- problems: 1-3 whiteboard design or reasoning problems solvable by talking and diagramming; include what a good answer looks like and 1-3 constraint changes to escalate.
- guardrailNotes: 4-8 topics the interviewer must never ask about (protected characteristics, family status, health, etc.), plus any JD-specific risks.
- ids: short and unique within the profile (c1.., s1.., q1.., t1.., p1..); competencyId in coreQuestions must match a competency id.
- Questions are spoken aloud: plain sentences, one question each.`;

export async function draftRoleProfile(i: { title: string; company: string; jdText: string }): Promise<RoleProfile> {
  if (isMockMode()) return fixtureRoleProfile(i);
  const text = `<untrusted_job_description>\n${i.jdText.slice(0, 30_000)}\n</untrusted_job_description>\nRole title: ${i.title}\nCompany: ${i.company}\nDraft the role profile.`;
  const p = await callStructured({ kind: "prep", system: SYSTEM, content: [{ type: "text", text }], schema: RoleProfileZ });

  // Keep references valid: drop core questions pointing at unknown competencies; clamp weights.
  const compIds = new Set(p.competencies.map((c) => c.id));
  const w = (n: number) => Math.min(5, Math.max(1, Math.round(n) || 3));
  return {
    ...p,
    mustHave: p.mustHave.map((s) => ({ ...s, weight: w(s.weight) })),
    niceToHave: p.niceToHave.map((s) => ({ ...s, weight: w(s.weight) })),
    competencies: p.competencies.map((c) => ({ ...c, weight: w(c.weight) })),
    coreQuestions: p.coreQuestions.filter((q) => compIds.has(q.competencyId)),
  };
}
