import { z } from "zod";

// Zod mirrors of types.ts (structured-output friendly: no min/max constraints; limits are enforced in prompts and code).
const id = z.string();
export const AnchorZ = z.object({ weak: z.string(), ok: z.string(), strong: z.string() });
export const SkillZ = z.object({ id, name: z.string(), weight: z.number(), evidenceHints: z.array(z.string()) });
export const CompetencyZ = z.object({ id, name: z.string(), description: z.string(), weight: z.number(), anchors: AnchorZ });
export const CoreQuestionZ = z.object({ id, competencyId: id, text: z.string(), followUps: z.array(z.string()) });
export const TechTopicZ = z.object({ id, name: z.string(), difficulty: z.enum(["junior", "mid", "senior"]), probes: z.array(z.string()) });
export const BoardProblemZ = z.object({
  id, title: z.string(), prompt: z.string(), goodAnswerLooksLike: z.string(), constraintChanges: z.array(z.string()),
});
export const RoleProfileZ = z.object({
  summary: z.string(), level: z.string(),
  mustHave: z.array(SkillZ), niceToHave: z.array(SkillZ),
  competencies: z.array(CompetencyZ), coreQuestions: z.array(CoreQuestionZ),
  technicalTopics: z.array(TechTopicZ), problems: z.array(BoardProblemZ),
  guardrailNotes: z.array(z.string()),
});

export const SourceKindZ = z.enum(["cv", "linkedin", "github", "web"]);
// Optional fields are modelled as nullable (strict structured output); normalized to optional in code.
export const SourceZ = z.object({ kind: SourceKindZ, quote: z.string(), page: z.number().nullable(), url: z.string().nullable() });
export const ClaimZ = z.object({ id, text: z.string(), skillIds: z.array(id), source: SourceZ });
export const TimelineItemZ = z.object({
  org: z.string(), title: z.string(), start: z.string(), end: z.string().nullable(), claimIds: z.array(id),
});
export const FlagZ = z.object({ id, kind: z.enum(["gap", "inconsistency", "unverified", "other"]), text: z.string(), claimIds: z.array(id) });
export const ResearchOutZ = z.object({
  headline: z.string(), claims: z.array(ClaimZ), timeline: z.array(TimelineItemZ), flags: z.array(FlagZ),
  webFindings: z.array(z.object({ url: z.string(), title: z.string(), summary: z.string() })),
});

export const BriefItemZ = z.object({
  bucket: z.enum(["matched", "unverified", "gap", "flag"]),
  skillOrCompetencyId: id.nullable(), claimId: id.nullable(), note: z.string(),
});
export const ProbeZ = z.object({
  phase: z.enum(["behavioral", "background", "technical"]),
  text: z.string(), competencyId: id.nullable(), skillId: id.nullable(), source: SourceZ.nullable(), followUps: z.array(z.string()),
});
export const PlanOutZ = z.object({
  brief: z.array(BriefItemZ),
  probes: z.array(ProbeZ),
  objectives: z.object({
    behavioral: z.array(z.string()), background: z.array(z.string()), technical: z.array(z.string()),
  }),
  problemId: id.nullable(),
});

export const ScoreOutZ = z.object({
  summary: z.string(),
  recommendation: z.enum(["advance", "human_review"]),
  recommendationReason: z.string(),
  criteria: z.array(z.object({
    criterionId: id,
    rating: z.number().nullable(), // 1-3 or null; clamped in code
    rationale: z.string(),
    evidence: z.array(z.object({ quote: z.string(), segmentId: id })),
  })),
  strengths: z.array(z.string()), concerns: z.array(z.string()), openQuestions: z.array(z.string()),
});
