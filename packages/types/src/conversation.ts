export type ConversationType =
  | "INTERVIEW"
  | "SALES"
  | "RESEARCH"
  | "MEETING"
  | "EXPERT_INTERVIEW"
  | "CUSTOM";

export type ConversationStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "LIVE"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type ProcessingStatus =
  | "NOT_STARTED"
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

export type ParticipantRole =
  | "HOST"
  | "PARTICIPANT"
  | "AI_AGENT"
  | "OBSERVER";

export type ConsentStatus = "PENDING" | "GRANTED" | "DENIED";

export type MembershipRole = "OWNER" | "ADMIN" | "MEMBER";

export type AgentMode =
  | "LISTENING"
  | "THINKING"
  | "SPEAKING"
  | "WAITING"
  | "CLARIFYING"
  | "FOLLOW_UP";

export type ClaimKind = "FACT" | "INFERENCE" | "UNCERTAINTY";

export type ImportanceCategory =
  | "KEY_FACT"
  | "DECISION"
  | "ACTION"
  | "INSIGHT"
  | "CONCERN"
  | "CONTRADICTION"
  | "QUESTION"
  | "BACKGROUND"
  | "LOW_VALUE";

export type TranscriptFilter =
  | "EVERYTHING"
  | "IMPORTANT"
  | "DECISIONS"
  | "ACTIONS"
  | "QUESTIONS"
  | "CONCERNS"
  | "CONTRADICTIONS";

export interface Objective {
  id: string;
  title: string;
  description: string;
  importance: number;
  status: "UNCOVERED" | "PARTIAL" | "COVERED" | "ABANDONED";
  evidenceIds: string[];
}

export interface Participant {
  id: string;
  displayName: string;
  role: ParticipantRole;
  isAgent: boolean;
  personId?: string;
}

export interface TranscriptSegment {
  id: string;
  speakerId: string;
  speakerName: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
  isFinal: boolean;
  importanceScore?: number;
  importanceReason?: string;
  category?: ImportanceCategory;
}

export interface Fact {
  id: string;
  text: string;
  kind: ClaimKind;
  evidenceSegmentIds: string[];
  objectiveIds: string[];
  confidence: number;
  createdAt: string;
}

export interface Question {
  id: string;
  prompt: string;
  objectiveId?: string;
  topicId?: string;
  expectedEvidence: string[];
  importance: number;
  difficulty: number;
  prerequisites: string[];
  followUpIds: string[];
  status: "PLANNED" | "ASKED" | "ANSWERED" | "SKIPPED" | "ABANDONED";
}

export interface Hypothesis {
  id: string;
  text: string;
  confidence: number;
  supportingFactIds: string[];
  contradictingFactIds: string[];
}

export interface Contradiction {
  id: string;
  summary: string;
  statementA: string;
  statementB: string;
  segmentIds: string[];
  resolved: boolean;
}

export interface Moment {
  id: string;
  label: string;
  timestampSeconds: number;
  category: ImportanceCategory;
  segmentId?: string;
  summary: string;
}

export interface ConversationState {
  conversationId: string;
  purpose: string;
  objectives: Objective[];
  participants: Participant[];
  currentSpeaker?: string;
  currentTopic?: string;
  recentTranscript: TranscriptSegment[];
  importantFacts: Fact[];
  unresolvedQuestions: Question[];
  coveredObjectives: string[];
  uncoveredObjectives: string[];
  candidateHypotheses: Hypothesis[];
  detectedContradictions: Contradiction[];
  importantMoments: Moment[];
  conversationTimeSeconds: number;
  agentMode: AgentMode;
}

export type NextActionType =
  | "ASK_QUESTION"
  | "FOLLOW_UP"
  | "CLARIFY"
  | "CHALLENGE"
  | "ANSWER"
  | "ACKNOWLEDGE"
  | "BRIDGE_TOPIC"
  | "REVISIT"
  | "WAIT"
  | "STAY_SILENT"
  | "WRAP_UP"
  | "END";

export interface NextAction {
  type: NextActionType;
  rationale: string;
  prompt?: string;
  questionId?: string;
  objectiveId?: string;
  priority: number;
}

export interface IntelligenceSnapshot {
  known: Fact[];
  unknown: string[];
  uncertain: Fact[];
  important: Fact[];
  lowValue: string[];
  followUp: string[];
  recommendedNextAction: NextAction | null;
}

export const CONVERSATION_TYPES: { value: ConversationType; label: string }[] = [
  { value: "INTERVIEW", label: "Interview" },
  { value: "SALES", label: "Sales" },
  { value: "RESEARCH", label: "Research" },
  { value: "MEETING", label: "Meeting" },
  { value: "EXPERT_INTERVIEW", label: "Expert interview" },
  { value: "CUSTOM", label: "Custom" },
];
