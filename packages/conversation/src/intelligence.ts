import type {
  ConversationState,
  Fact,
  IntelligenceSnapshot,
  NextAction,
  Question,
} from "@kimma/types";
import { selectNextAction } from "./strategy";

export function buildIntelligenceSnapshot(
  state: ConversationState,
  questions: Question[],
): IntelligenceSnapshot {
  const known = state.importantFacts.filter((fact) => fact.kind === "FACT");
  const uncertain = state.importantFacts.filter(
    (fact) => fact.kind === "UNCERTAINTY" || fact.kind === "INFERENCE",
  );
  const unknown = unknownFromObjectives(state, questions);
  const important = [...known, ...uncertain].filter((fact) => fact.confidence >= 0.55);
  const recommendedNextAction: NextAction | null = selectNextAction(state, questions);

  return {
    known,
    unknown,
    uncertain,
    important,
    lowValue: state.recentTranscript
      .filter((segment) => segment.category === "LOW_VALUE" || segment.category === "BACKGROUND")
      .map((segment) => segment.text),
    followUp: [
      ...state.detectedContradictions.filter((item) => !item.resolved).map((item) => item.summary),
      ...unknown.slice(0, 5),
    ],
    recommendedNextAction,
  };
}

function unknownFromObjectives(state: ConversationState, questions: Question[]): string[] {
  const knownText = state.importantFacts.map((fact) => fact.text.toLowerCase()).join(" ");
  const fromQuestions = questions
    .filter((question) => question.status === "PLANNED" || question.status === "ASKED")
    .flatMap((question) => question.expectedEvidence)
    .filter((item) => item && !knownText.includes(item.toLowerCase()));

  const fromObjectives = state.objectives
    .filter((objective) => objective.status === "UNCOVERED" || objective.status === "PARTIAL")
    .map((objective) => objective.title);

  return unique([...fromObjectives, ...fromQuestions]);
}

export function detectContradictions(facts: Fact[]): Array<{
  summary: string;
  statementA: string;
  statementB: string;
}> {
  const pairs: Array<{ summary: string; statementA: string; statementB: string }> = [];
  const consistencyWords: Array<[RegExp, RegExp, string]> = [
    [/\bstrongly consistent\b/i, /\beventual(ly)? consistent\b/i, "Consistency model"],
    [/\bnever\b/i, /\balways\b/i, "Absolute claim"],
    [/\blead\b/i, /\bindividual contributor\b|\bic\b/i, "Role seniority"],
  ];

  for (let i = 0; i < facts.length; i += 1) {
    for (let j = i + 1; j < facts.length; j += 1) {
      const a = facts[i];
      const b = facts[j];
      if (!a || !b) continue;
      for (const [left, right, label] of consistencyWords) {
        const hit =
          (left.test(a.text) && right.test(b.text)) || (right.test(a.text) && left.test(b.text));
        if (hit) {
          pairs.push({
            summary: `${label} statements appear inconsistent`,
            statementA: a.text,
            statementB: b.text,
          });
        }
      }
    }
  }
  return pairs;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
