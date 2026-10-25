import { prisma } from "@kimma/database";
import {
  addFact,
  appendTranscript,
  createInitialState,
  markObjective,
  questionsCoveredByUtterance,
  scoreSegment,
  setAgentMode,
} from "@kimma/conversation";
import { conversationMemory, decide } from "@kimma/intelligence";
import type {
  AgentMode,
  ConversationState,
  Fact,
  NextAction,
  TranscriptSegment,
} from "@kimma/types";
import { readConversationState, writeConversationState } from "@/server/conversation-state";

export async function loadOrCreateState(conversationId: string): Promise<ConversationState> {
  const existing = await readConversationState(conversationId);
  if (existing) return existing;

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: {
      objectives: { orderBy: { sortOrder: "asc" } },
      participants: true,
      questions: true,
    },
  });

  const state = createInitialState({
    conversationId,
    purpose: conversation.purpose,
    objectives: conversation.objectives.map((o) => ({
      id: o.id,
      title: o.title,
      description: o.description,
      importance: o.importance,
      status: o.status as ConversationState["objectives"][number]["status"],
      evidenceIds: [],
    })),
    participants: conversation.participants.map((p) => ({
      id: p.identity,
      displayName: p.displayName,
      role: p.role,
      isAgent: p.isAgent,
      personId: p.personId ?? undefined,
    })),
  });
  state.unresolvedQuestions = conversation.questions.map((q) => ({
    id: q.id,
    prompt: q.prompt,
    objectiveId: q.objectiveId ?? undefined,
    topicId: q.topicId ?? undefined,
    expectedEvidence: Array.isArray(q.expectedEvidence) ? (q.expectedEvidence as string[]) : [],
    importance: q.importance,
    difficulty: q.difficulty,
    prerequisites: Array.isArray(q.prerequisites) ? (q.prerequisites as string[]) : [],
    followUpIds: Array.isArray(q.followUpIds) ? (q.followUpIds as string[]) : [],
    status: q.status as ConversationState["unresolvedQuestions"][number]["status"],
  }));
  await writeConversationState(state);
  return state;
}

export async function ingestTranscriptSegment(
  conversationId: string,
  segment: TranscriptSegment,
): Promise<ConversationState> {
  let state = await loadOrCreateState(conversationId);
  const scored = scoreSegment(segment, {
    purpose: state.purpose,
    objectiveTitles: state.objectives.map((o) => o.title),
  });
  const enriched: TranscriptSegment = { ...segment, ...scored };

  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: conversationId },
    include: { transcript: true, questions: true },
  });

  let transcriptId = conversation.transcript?.id;
  if (!transcriptId) {
    const created = await prisma.transcript.create({
      data: { conversationId, status: "RUNNING" },
    });
    transcriptId = created.id;
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { transcriptStatus: "RUNNING" },
    });
  }

  if (enriched.isFinal && transcriptId) {
    const duplicate = await prisma.transcriptSegment.findFirst({
      where: { transcriptId, startTime: enriched.startTime, text: enriched.text },
    });
    if (duplicate) return state;
  }

  state = appendTranscript(state, enriched);

  if (enriched.isFinal && transcriptId) {
    await prisma.transcriptSegment.create({
      data: {
        transcriptId,
        speakerId: enriched.speakerId,
        speakerName: enriched.speakerName,
        text: enriched.text,
        startTime: enriched.startTime,
        endTime: enriched.endTime,
        confidence: enriched.confidence,
        isFinal: true,
        importanceScore: enriched.importanceScore,
        importanceReason: enriched.importanceReason,
        category: enriched.category,
      },
    });

    const covered = questionsCoveredByUtterance(state.unresolvedQuestions, enriched.text);
    if (covered.length > 0) {
      state = {
        ...state,
        unresolvedQuestions: state.unresolvedQuestions.map((q) =>
          covered.includes(q.id) ? { ...q, status: "ANSWERED" } : q,
        ),
      };
      await prisma.conversationQuestion.updateMany({
        where: { id: { in: covered }, conversationId },
        data: { status: "SKIPPED" },
      });
    }
  }

  await writeConversationState(state);
  return state;
}

export async function applyFact(conversationId: string, fact: Fact): Promise<ConversationState> {
  let state = await loadOrCreateState(conversationId);
  if (state.importantFacts.some((item) => item.text === fact.text)) return state;
  state = addFact(state, fact);
  await prisma.conversationEvent.create({
    data: {
      conversationId,
      type: "FACT_SAVED",
      data: fact as unknown as object,
    },
  });
  await writeConversationState(state);
  return state;
}

export async function applyObjectiveStatus(
  conversationId: string,
  objectiveId: string,
  status: "COVERED" | "PARTIAL" | "UNCOVERED" | "ABANDONED",
): Promise<ConversationState> {
  let state = await loadOrCreateState(conversationId);
  state = markObjective(state, objectiveId, status);
  await prisma.conversationObjective.updateMany({
    where: { id: objectiveId, conversationId },
    data: { status },
  });
  await prisma.conversationEvent.create({
    data: {
      conversationId,
      type: "OBJECTIVE_UPDATED",
      data: { objectiveId, status },
    },
  });
  await writeConversationState(state);
  return state;
}

export async function applyAgentMode(conversationId: string, mode: AgentMode): Promise<void> {
  const state = setAgentMode(await loadOrCreateState(conversationId), mode);
  await writeConversationState(state);
}

export async function nextDecision(conversationId: string) {
  const state = await loadOrCreateState(conversationId);
  const decision = decide(state, state.unresolvedQuestions);
  return { state, decision, memory: conversationMemory(state) };
}

export async function nextActionFor(conversationId: string): Promise<NextAction> {
  const { decision } = await nextDecision(conversationId);
  return decision.next;
}
