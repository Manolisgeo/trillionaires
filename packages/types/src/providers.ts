export interface MeetingProvider {
  createMeeting(input: CreateMeetingInput): Promise<MeetingSession>;
  joinMeeting(input: JoinMeetingInput): Promise<MeetingJoin>;
  leaveMeeting(meetingId: string): Promise<void>;
  receiveMedia?(meetingId: string): Promise<void>;
}

export interface CreateMeetingInput {
  conversationId: string;
  title: string;
  metadata?: Record<string, string>;
}

export interface MeetingSession {
  provider: string;
  meetingId: string;
  roomName: string;
}

export interface JoinMeetingInput {
  conversationId: string;
  identity: string;
  name: string;
  role: "host" | "participant" | "agent" | "observer";
}

export interface MeetingJoin {
  serverUrl: string;
  roomName: string;
  participantToken: string;
  participantName: string;
}

export interface TelephonyProvider {
  provisionNumber?(input: { organizationId: string }): Promise<{ phoneNumber: string }>;
  startInboundCall(input: InboundCallInput): Promise<{ callId: string }>;
  startOutboundCall(input: OutboundCallInput): Promise<{ callId: string }>;
  hangup(callId: string): Promise<void>;
}

export interface InboundCallInput {
  to: string;
  from: string;
  conversationId?: string;
}

export interface OutboundCallInput {
  to: string;
  from: string;
  conversationId: string;
}

export interface AvatarSession {
  id: string;
  provider: string;
  identityLabel: string;
}

export interface AvatarProvider {
  createSession(input: {
    conversationId: string;
    identity: { name: string; personality?: string };
  }): Promise<AvatarSession>;
  connect(sessionId: string, roomName: string): Promise<void>;
  disconnect(sessionId: string): Promise<void>;
}

export interface RealtimeVoiceProvider {
  readonly name: string;
  readonly model: string;
}

export interface CompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  model?: string;
  messages: CompletionMessage[];
  jsonSchema?: Record<string, unknown>;
  temperature?: number;
}

export interface CompletionResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
}

export interface AnalysisProvider {
  complete(request: CompletionRequest): Promise<CompletionResult>;
}

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

export interface ObjectStorageProvider {
  putObject(input: {
    key: string;
    body: Buffer | Uint8Array;
    contentType: string;
  }): Promise<{ key: string }>;
  getSignedUrl(key: string, expiresInSeconds: number): Promise<string>;
  deleteObject(key: string): Promise<void>;
}

export interface TurnDetectorConfig {
  kind: "semantic_vad" | "server_vad" | "external";
  eagerness?: "low" | "medium" | "high" | "auto";
  interruptResponse: boolean;
}
