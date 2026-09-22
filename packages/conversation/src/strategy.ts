import type {
  ConversationState,
  NextAction,
  Question,
} from "@aperture/types";
import { lastHumanUtterance } from "./state";

const VAGUE_RE =
  /\b(kind of|sort of|maybe|i think|probably|various|stuff|things|a lot)\b/i;
const QUESTION_TO_AGENT_RE = /\?$|\b(can you|what do you|do you think|tell me)\b/i;

function alreadyEstablished(state: ConversationState, question: Question): boolean {
  const expected = question.expectedEvidence.map((item) => item.toLowerCase());
  if (expected.length === 0) return question.status === "ANSWERED";
  const corpus = [
    ...state.importantFacts.map((fact) => fact.text),
    ...state.recentTranscript.map((segment) => segment.text),
  ]
    .join(" ")
    .toLowerCase();
  const hits = expected.filter((needle) => needle.length > 3 && corpus.includes(needle));
  return hits.length >= Math.ceil(expected.length * 0.6);
}

function prerequisitesMet(question: Question, state: ConversationState): boolean {
  if (question.prerequisites.length === 0) return true;
  const covered = new Set(state.coveredObjectives);
  const answered = new Set(
    state.unresolvedQuestions
      .filter((item) => item.status === "ANSWERED")
      .map((item) => item.id),
  );
  return question.prerequisites.every((id) => covered.has(id) || answered.has(id));
}

export function selectNextAction(
  state: ConversationState,
  questions: Question[],
): NextAction {
  const lastHuman = lastHumanUtterance(state);
  const lastText = lastHuman?.text ?? "";

  if (!lastHuman && state.conversationTimeSeconds < 8) {
    return {
      type: "ASK_QUESTION",
      rationale: "Open the conversation against the primary objective.",
      prompt: openingPrompt(state),
      objectiveId: state.uncoveredObjectives[0],
      priority: 0.9,
    };
  }

  if (lastText && QUESTION_TO_AGENT_RE.test(lastText) && lastText.trim().endsWith("?")) {
    return {
      type: "ANSWER",
      rationale: "Participant asked a question; answer before continuing.",
      prompt: lastText,
      priority: 0.95,
    };
  }

  if (state.detectedContradictions.some((item) => !item.resolved)) {
    const contradiction = state.detectedContradictions.find((item) => !item.resolved);
    return {
      type: "CHALLENGE",
      rationale: "Two statements may conflict. Ask the participant to reconcile them. Do not decide which one is true.",
      prompt: contradiction
        ? `Earlier you said “${contradiction.statementA}”, and later “${contradiction.statementB}”. Can you help me reconcile those?`
        : undefined,
      priority: 0.93,
    };
  }

  if (lastText && VAGUE_RE.test(lastText) && lastText.split(/\s+/).length < 40) {
    return {
      type: "CLARIFY",
      rationale: "Last answer was vague relative to the objective.",
      prompt: "Can you make that concrete — what happened, what you owned, and how it turned out?",
      objectiveId: state.uncoveredObjectives[0],
      priority: 0.84,
    };
  }

  const unanswered = questions
    .filter((question) => question.status === "PLANNED" || question.status === "ASKED")
    .filter((question) => !alreadyEstablished(state, question))
    .filter((question) => prerequisitesMet(question, state))
    .sort((a, b) => b.importance - a.importance);

  const skippable = questions.filter(
    (question) =>
      (question.status === "PLANNED" || question.status === "ASKED") &&
      alreadyEstablished(state, question),
  );

  if (unanswered.length === 0) {
    if (state.uncoveredObjectives.length === 0) {
      return {
        type: "WRAP_UP",
        rationale: "Objectives are covered; close the conversation.",
        prompt: "I think I have what I need. Is there anything I missed that we should cover?",
        priority: 0.7,
      };
    }
    return {
      type: "ASK_QUESTION",
      rationale: "No planned questions remain; probe the next uncovered objective.",
      prompt: `Let's talk about ${objectiveTitle(state, state.uncoveredObjectives[0])}. What should I know?`,
      objectiveId: state.uncoveredObjectives[0],
      priority: 0.72,
    };
  }

  const next = unanswered[0];
  if (!next) {
    return { type: "WAIT", rationale: "No actionable next step.", priority: 0.2 };
  }

  if (skippable.length > 0) {
    return {
      type: "ASK_QUESTION",
      rationale: `Skipping ${skippable.length} planned question(s) already answered in conversation; asking highest-value remaining question.`,
      prompt: next.prompt,
      questionId: next.id,
      objectiveId: next.objectiveId,
      priority: next.importance,
    };
  }

  if (lastText.length > 400) {
    return {
      type: "FOLLOW_UP",
      rationale: "Verbose answer likely contains a thread worth investigating.",
      prompt: "You covered a lot there — what's the part you're most proud of, and what would you change?",
      objectiveId: next.objectiveId,
      priority: 0.77,
    };
  }

  return {
    type: "ASK_QUESTION",
    rationale: "Highest-value uncovered question given current known/unknown state.",
    prompt: next.prompt,
    questionId: next.id,
    objectiveId: next.objectiveId,
    priority: next.importance,
  };
}

function openingPrompt(state: ConversationState): string {
  const first = state.objectives[0]?.title;
  return first
    ? `Thanks for joining. Today I want to understand ${state.purpose}. Let's start with ${first}.`
    : `Thanks for joining. ${state.purpose}`;
}

function objectiveTitle(state: ConversationState, id: string | undefined): string {
  return state.objectives.find((objective) => objective.id === id)?.title ?? "the remaining goal";
}

export function questionsCoveredByUtterance(
  questions: Question[],
  utterance: string,
): string[] {
  const lower = utterance.toLowerCase();
  return questions
    .filter((question) => question.status === "PLANNED")
    .filter((question) => {
      if (question.expectedEvidence.length === 0) return false;
      const hits = question.expectedEvidence.filter(
        (item) => item.length > 3 && lower.includes(item.toLowerCase()),
      );
      return hits.length >= Math.ceil(question.expectedEvidence.length * 0.6);
    })
    .map((question) => question.id);
}
