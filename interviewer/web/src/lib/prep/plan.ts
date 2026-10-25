import { env } from "../env";
import type { Brief, Candidate, Id, Phase, Plan, PlannedQuestion, Role, RoleProfile, Source } from "../types";
import { PHASES } from "../types";
import { newId } from "../store";
import { callStructured, isMockMode, UNTRUSTED_RULE } from "../claude";
import { PlanOutZ } from "./schemas";
import type { z } from "zod";
import { fixtureBriefAndPlan } from "./fixtures";

type PlanOut = z.infer<typeof PlanOutZ>;

export function phaseMinutes(): Record<Phase, number> {
  return env("DEMO_SHORT_INTERVIEW") === "1"
    ? { intro: 1, behavioral: 3, background: 3, technical: 4, close: 1 }
    : { intro: 2, behavioral: 10, background: 8, technical: 15, close: 3 };
}

const src = (s: PlanOut["probes"][number]["source"]): Source | null =>
  s ? { kind: s.kind, quote: s.quote, ...(s.page != null ? { page: s.page } : {}), ...(s.url ? { url: s.url } : {}) } : null;

/** Deterministic plan assembly: core questions always all present and in order; ids and minutes enforced in code. */
export function assemblePlan(role: RoleProfile, out: Pick<PlanOut, "probes" | "objectives" | "problemId">): Plan {
  const compIds = new Set(role.competencies.map((c) => c.id));
  const skillIds = new Set([...role.mustHave, ...role.niceToHave].map((s) => s.id));
  const mins = phaseMinutes();
  const probe = (p: PlanOut["probes"][number]): PlannedQuestion => ({
    id: newId(), kind: "probe", text: p.text,
    competencyId: p.competencyId && compIds.has(p.competencyId) ? p.competencyId : null,
    skillId: p.skillId && skillIds.has(p.skillId) ? p.skillId : null,
    source: src(p.source), followUps: p.followUps,
  });
  const probesFor = (ph: Phase) => out.probes.filter((p) => p.phase === ph).map(probe);
  const problemId = out.problemId && role.problems.some((p) => p.id === out.problemId) ? out.problemId : role.problems[0]?.id;
  const phases = PHASES.map((phase) => {
    const base = { phase, minutes: mins[phase] };
    switch (phase) {
      case "intro":
        return { ...base, objectives: ["Disclose that Aperture is an AI, explain recording and how the call works", "Put the candidate at ease"], questions: [] };
      case "behavioral":
        return {
          ...base, objectives: out.objectives.behavioral,
          questions: [
            ...role.coreQuestions.map((q): PlannedQuestion => ({
              id: q.id, kind: "core", text: q.text, competencyId: q.competencyId, skillId: null, source: null, followUps: q.followUps,
            })),
            ...probesFor("behavioral"),
          ],
        };
      case "background":
        return { ...base, objectives: out.objectives.background, questions: probesFor("background") };
      case "technical":
        return { ...base, objectives: out.objectives.technical, questions: probesFor("technical"), ...(problemId ? { problemId } : {}) };
      case "close":
        return { ...base, objectives: ["Answer the candidate's questions about the process", "Explain next steps and that a human decides"], questions: [] };
    }
  });
  return { phases };
}

function sanitizeBrief(items: PlanOut["brief"], role: RoleProfile, candidate: Candidate): Brief {
  const ids = new Set<Id>([...role.mustHave, ...role.niceToHave, ...role.competencies].map((x) => x.id));
  const claimIds = new Set(candidate.profile?.claims.map((c) => c.id) ?? []);
  return {
    items: items.map((i) => ({
      bucket: i.bucket,
      skillOrCompetencyId: i.skillOrCompetencyId && ids.has(i.skillOrCompetencyId) ? i.skillOrCompetencyId : null,
      claimId: i.claimId && claimIds.has(i.claimId) ? i.claimId : null,
      note: i.note,
    })),
  };
}

const SYSTEM = `You prepare a structured interview for an AI interviewer (Aperture). Output follows the schema exactly.
${UNTRUSTED_RULE}
Rules:
- brief: one item per must-have skill (bucket matched = CV/GitHub evidence supports it; unverified = claimed but vague or unquantified; gap = no evidence), plus "flag" items for inconsistencies or timeline gaps. Use the given ids; claimId must come from the candidate's claims. note is one plain sentence.
- probes: personalized questions that cite the candidate's actual work.
  * behavioral: 1-3 probes; STAR-style, tied to a competency. The role's fixed core questions are added separately, so do not repeat them.
  * background: 3-6 probes, each about one specific claim. Always set source to that claim's source (kind, exact quote, page, url) so the agent can highlight it.
  * technical: 2-4 probes adapted to the level and the technicalTopics; no code execution, discussion and diagramming only.
  * Questions are spoken aloud: one question, plain sentences, no markdown. Neutral, never accusatory. Never touch the role's guardrailNotes topics.
- objectives: 1-3 short, checkable objectives per phase.
- problemId: the whiteboard problem best suited to this candidate's level, from the role's problems.`;

export async function compileBriefAndPlan(i: { role: Role; candidate: Candidate }): Promise<{ brief: Brief; plan: Plan }> {
  const { role, candidate } = i;
  if (!role.profile) throw new Error("Role has no profile yet; approve a drafted profile first.");
  if (!candidate.profile) throw new Error("Candidate research is not finished; no profile to plan from.");
  if (isMockMode()) return fixtureBriefAndPlan(role, candidate);

  const live = { ...candidate.profile, claims: candidate.profile.claims.filter((c) => !c.removedByCandidate) };
  const text =
    `<role_profile>\n${JSON.stringify(role.profile)}\n</role_profile>\n` +
    `<untrusted_candidate_profile>\n${JSON.stringify(live)}\n</untrusted_candidate_profile>\n` +
    `Role: ${role.title} at ${role.company}. Build the brief and the personalized probes.`;
  const out = await callStructured({ kind: "prep", system: SYSTEM, content: [{ type: "text", text }], schema: PlanOutZ });
  return { brief: sanitizeBrief(out.brief, role.profile, { ...candidate, profile: live }), plan: assemblePlan(role.profile, out) };
}
