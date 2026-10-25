import type {
  ConversationState,
  Fact,
  Objective,
  TranscriptSegment,
} from "@kimma/types";

const ROLLING_TRANSCRIPT_LIMIT = 24;

export function createInitialState(input: {
  conversationId: string;
  purpose: string;
  objectives: Objective[];
  participants: ConversationState["participants"];
}): ConversationState {
  return {
    conversationId: input.conversationId,
    purpose: input.purpose,
    objectives: input.objectives,
    participants: input.participants,
    recentTranscript: [],
    importantFacts: [],
    unresolvedQuestions: [],
    coveredObjectives: [],
    uncoveredObjectives: input.objectives.map((objective) => objective.id),
    candidateHypotheses: [],
    detectedContradictions: [],
    importantMoments: [],
    conversationTimeSeconds: 0,
    agentMode: "LISTENING",
  };
}

export function appendTranscript(
  state: ConversationState,
  segment: TranscriptSegment,
): ConversationState {
  const recent = [...state.recentTranscript, segment].slice(-ROLLING_TRANSCRIPT_LIMIT);
  return {
    ...state,
    currentSpeaker: segment.speakerId,
    recentTranscript: recent,
    conversationTimeSeconds: Math.max(state.conversationTimeSeconds, segment.endTime),
  };
}

export function setAgentMode(
  state: ConversationState,
  agentMode: ConversationState["agentMode"],
): ConversationState {
  return { ...state, agentMode };
}

export function addFact(state: ConversationState, fact: Fact): ConversationState {
  if (state.importantFacts.some((existing) => existing.id === fact.id)) {
    return state;
  }
  return {
    ...state,
    importantFacts: [...state.importantFacts, fact],
  };
}

export function markObjective(
  state: ConversationState,
  objectiveId: string,
  status: Objective["status"],
): ConversationState {
  const objectives = state.objectives.map((objective) =>
    objective.id === objectiveId ? { ...objective, status } : objective,
  );
  return {
    ...state,
    objectives,
    coveredObjectives: objectives
      .filter((objective) => objective.status === "COVERED")
      .map((objective) => objective.id),
    uncoveredObjectives: objectives
      .filter((objective) => objective.status === "UNCOVERED" || objective.status === "PARTIAL")
      .map((objective) => objective.id),
  };
}

export function lastFinalUtterance(state: ConversationState): TranscriptSegment | undefined {
  for (let index = state.recentTranscript.length - 1; index >= 0; index -= 1) {
    const segment = state.recentTranscript[index];
    if (segment?.isFinal && segment.text.trim().length > 0) {
      return segment;
    }
  }
  return undefined;
}

export function lastHumanUtterance(state: ConversationState): TranscriptSegment | undefined {
  const agentIds = new Set(
    state.participants.filter((participant) => participant.isAgent).map((p) => p.id),
  );
  for (let index = state.recentTranscript.length - 1; index >= 0; index -= 1) {
    const segment = state.recentTranscript[index];
    if (segment?.isFinal && !agentIds.has(segment.speakerId) && segment.text.trim()) {
      return segment;
    }
  }
  return undefined;
}
