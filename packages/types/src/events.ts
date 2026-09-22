export type ConversationEventType =
  | "SESSION_STARTED"
  | "SESSION_ENDED"
  | "AGENT_JOINED"
  | "AGENT_LEFT"
  | "TURN_STARTED"
  | "TURN_ENDED"
  | "INTERRUPTION"
  | "FALSE_INTERRUPTION"
  | "TRANSCRIPT_PARTIAL"
  | "TRANSCRIPT_FINAL"
  | "TOOL_CALL"
  | "FACT_SAVED"
  | "OBJECTIVE_UPDATED"
  | "QUESTION_ASKED"
  | "QUESTION_SKIPPED"
  | "FOLLOW_UP"
  | "MOMENT"
  | "CONSENT"
  | "RECORDING_STARTED"
  | "RECORDING_STOPPED"
  | "ANALYSIS_STARTED"
  | "ANALYSIS_COMPLETED"
  | "ERROR"
  | "TELEMETRY";

export interface ConversationEventPayload {
  type: ConversationEventType;
  conversationId: string;
  sessionId?: string;
  agentSessionId?: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface TelemetryMetrics {
  speechToTextMs?: number;
  turnDetectionMs?: number;
  llmTimeToFirstTokenMs?: number;
  ttsTimeToFirstAudioMs?: number;
  endToEndResponseMs?: number;
  interruptionLatencyMs?: number;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
}

export type AgentToolName =
  | "get_conversation_objectives"
  | "get_conversation_state"
  | "get_next_action"
  | "save_fact"
  | "mark_objective_complete"
  | "mark_follow_up"
  | "create_action_item"
  | "save_transcript_segment"
  | "record_event"
  | "end_conversation"
  | "search_previous_conversations"
  | "search_knowledge_base"
  | "schedule_follow_up"
  | "get_candidate_profile";
