import { callNo } from "./format";
import type { Interview, Plan, PlannedQuestion } from "./types";

/** Whitespace/punctuation/case-insensitive form used to match a spoken or displayed question to the plan. */
export const normQuestion = (s: string): string => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export interface PlanPos { phaseIndex: number; questionIndex: number; question: PlannedQuestion }

/** Position of a planned question by id. */
export function locateQuestion(plan: Plan, questionId: string): PlanPos | null {
  for (let p = 0; p < plan.phases.length; p++) {
    const qi = plan.phases[p].questions.findIndex((q) => q.id === questionId);
    if (qi >= 0) return { phaseIndex: p, questionIndex: qi, question: plan.phases[p].questions[qi] };
  }
  return null;
}

/** Position of a planned question by its text; `preferPhase` wins when the same text appears twice. */
export function locateQuestionByText(plan: Plan, text: string, preferPhase?: number): PlanPos | null {
  const target = normQuestion(text);
  const inPhase = (p: number): PlanPos | null => {
    const qs = plan.phases[p]?.questions ?? [];
    const qi = qs.findIndex((q) => normQuestion(q.text) === target);
    return qi >= 0 ? { phaseIndex: p, questionIndex: qi, question: qs[qi] } : null;
  };
  if (preferPhase !== undefined && preferPhase >= 0) {
    const hit = inPhase(preferPhase);
    if (hit) return hit;
  }
  for (let p = 0; p < plan.phases.length; p++) {
    const hit = inPhase(p);
    if (hit) return hit;
  }
  return null;
}

/** THE call tag of a planned question ("Q2.3"). The room slip, the outline, the card and the report all use this. */
export function questionLabel(plan: Plan, questionId: string): string | null {
  const pos = locateQuestion(plan, questionId);
  return pos ? callNo.question(pos.phaseIndex + 1, pos.questionIndex + 1) : null;
}

export interface QuestionRef { id: string; label: string; question: PlannedQuestion }

/**
 * The planned question behind a piece of evidence: the latest "question" desk event at or before evidence.t, matched
 * to the plan by text; else the first planned question that targets the criterion (competencyId or skillId);
 * else null (no chip).
 */
export function questionForEvidence(
  interview: Pick<Interview, "plan" | "events">,
  evidence: { t: number },
  criterionId: string,
): QuestionRef | null {
  const asked = interview.events
    .filter((e) => e.type === "question" && e.t <= evidence.t && typeof (e.payload as { text?: unknown } | null)?.text === "string")
    .sort((a, b) => b.t - a.t || b.seq - a.seq)[0];
  if (asked) {
    const pos = locateQuestionByText(interview.plan, (asked.payload as { text: string }).text);
    if (pos) return { id: pos.question.id, label: callNo.question(pos.phaseIndex + 1, pos.questionIndex + 1), question: pos.question };
  }
  for (let p = 0; p < interview.plan.phases.length; p++) {
    const qi = interview.plan.phases[p].questions.findIndex((q) => q.competencyId === criterionId || q.skillId === criterionId);
    if (qi >= 0) {
      const question = interview.plan.phases[p].questions[qi];
      return { id: question.id, label: callNo.question(p + 1, qi + 1), question };
    }
  }
  return null;
}
