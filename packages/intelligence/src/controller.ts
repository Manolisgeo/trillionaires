import { selectNextAction } from "@aperture/conversation";
import type { ConversationState, NextAction, NextActionType, Question } from "@aperture/types";

/** What the controller may do. The realtime model may propose; this list is what actually happens. */
export type ControllerAction =
  | "SPEAK"
  | "ASK"
  | "FOLLOW_UP"
  | "CLARIFY"
  | "CHALLENGE"
  | "WAIT"
  | "CHANGE_TOPIC"
  | "REVISIT"
  | "END"
  | "ANSWER"
  | "LISTEN";

export type Decision = {
  action: ControllerAction;
  next: NextAction;
};

const ACTION_MAP: Record<NextActionType, ControllerAction> = {
  ASK_QUESTION: "ASK",
  FOLLOW_UP: "FOLLOW_UP",
  CLARIFY: "CLARIFY",
  CHALLENGE: "CHALLENGE",
  ANSWER: "ANSWER",
  ACKNOWLEDGE: "SPEAK",
  BRIDGE_TOPIC: "CHANGE_TOPIC",
  REVISIT: "REVISIT",
  WAIT: "WAIT",
  STAY_SILENT: "LISTEN",
  WRAP_UP: "END",
  END: "END",
};

function lastHuman(state: ConversationState) {
  for (let i = state.recentTranscript.length - 1; i >= 0; i -= 1) {
    const segment = state.recentTranscript[i];
    if (segment && !segment.speakerName.toLowerCase().includes("aperture")) return segment;
  }
  return undefined;
}

/**
 * Chooses the next conversational move.
 * A long, just-finished turn yields LISTEN so the model does not talk over someone.
 */
export function decide(state: ConversationState, questions: Question[]): Decision {
  const recent = lastHuman(state);
  const words = recent?.text.split(/\s+/).length ?? 0;
  const justSpoke = recent !== undefined && state.conversationTimeSeconds - recent.endTime < 1.5;
  if (recent && justSpoke && words > 18) {
    return {
      action: "LISTEN",
      next: {
        type: "WAIT",
        rationale: "The participant just finished a substantial turn. Stay quiet unless they pause.",
        priority: 0.99,
      },
    };
  }

  const next = selectNextAction(state, questions);
  return { action: ACTION_MAP[next.type], next };
}
