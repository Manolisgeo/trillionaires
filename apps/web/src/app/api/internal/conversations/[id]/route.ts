import { NextResponse } from "next/server";
import { requireAgentAuth } from "@/server/agent-auth";
import {
  applyAgentMode,
  applyFact,
  applyObjectiveStatus,
  ingestTranscriptSegment,
  nextDecision,
} from "@/server/agent-runtime";
import { prisma } from "@kimma/database";
import { enqueueJob, processDueJobs } from "@/server/jobs";
import type { AgentMode, Fact, TranscriptSegment } from "@kimma/types";
import { after } from "next/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = requireAgentAuth(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const { state, decision, memory } = await nextDecision(id);
  return NextResponse.json({
    state,
    nextAction: decision.next,
    controllerAction: decision.action,
    memory,
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const unauthorized = requireAgentAuth(request);
  if (unauthorized) return unauthorized;
  const { id } = await context.params;
  const body = (await request.json()) as {
    tool: string;
    payload?: Record<string, unknown>;
  };
  const idempotencyKey = request.headers.get("Idempotency-Key")?.slice(0, 200) || undefined;
  if (idempotencyKey) {
    const prior = await prisma.agentRequest.findUnique({
      where: { conversationId_idempotencyKey: { conversationId: id, idempotencyKey } },
    });
    if (prior) return NextResponse.json(prior.response);
  }

  const result = await runTool(id, body.tool, body.payload ?? {});
  if (idempotencyKey && result.status === 200) {
    await prisma.agentRequest.create({
      data: {
        conversationId: id,
        idempotencyKey,
        response: JSON.parse(JSON.stringify(result.body)),
      },
    });
  }
  return NextResponse.json(result.body, { status: result.status });
}

async function runTool(
  id: string,
  tool: string,
  payload: Record<string, unknown>,
): Promise<{ status: number; body: unknown }> {
  switch (tool) {
    case "get_conversation_objectives": {
      const objectives = await prisma.conversationObjective.findMany({
        where: { conversationId: id },
        orderBy: { sortOrder: "asc" },
      });
      return { status: 200, body: { objectives } };
    }
    case "get_conversation_state": {
      const { state, memory } = await nextDecision(id);
      return { status: 200, body: { state, memory } };
    }
    case "get_next_action": {
      const { decision, memory } = await nextDecision(id);
      return { status: 200, body: { nextAction: decision.next, controllerAction: decision.action, memory } };
    }
    case "save_transcript_segment": {
      const state = await ingestTranscriptSegment(id, payload as unknown as TranscriptSegment);
      return { status: 200, body: { state } };
    }
    case "save_fact": {
      const fact = payload as unknown as Fact;
      const state = await applyFact(id, {
        ...fact,
        id: fact.id || crypto.randomUUID(),
        createdAt: fact.createdAt || new Date().toISOString(),
        evidenceSegmentIds: fact.evidenceSegmentIds ?? [],
        objectiveIds: fact.objectiveIds ?? [],
        kind: fact.kind ?? "FACT",
        confidence: fact.confidence ?? 0.7,
        text: fact.text,
      });
      return { status: 200, body: { state } };
    }
    case "mark_objective_complete": {
      const objectiveId = String(payload.objectiveId ?? "");
      const status = (payload.status as "COVERED" | "PARTIAL" | "UNCOVERED" | "ABANDONED") ?? "COVERED";
      const state = await applyObjectiveStatus(id, objectiveId, status);
      return { status: 200, body: { state } };
    }
    case "mark_follow_up": {
      await prisma.conversationEvent.create({
        data: {
          conversationId: id,
          type: "FOLLOW_UP",
          data: payload as object,
        },
      });
      return { status: 200, body: { ok: true } };
    }
    case "create_action_item": {
      const conversation = await prisma.conversation.findUniqueOrThrow({ where: { id } });
      const item = await prisma.actionItem.create({
        data: {
          conversationId: id,
          organizationId: conversation.organizationId,
          text: String(payload.text ?? ""),
          owner: payload.owner ? String(payload.owner) : undefined,
        },
      });
      return { status: 200, body: { item } };
    }
    case "record_event": {
      const type = String(payload.type ?? "TOOL_CALL");
      if (type === "AGENT_MODE" && payload.mode) {
        await applyAgentMode(id, payload.mode as AgentMode);
      }
      await prisma.conversationEvent.create({
        data: {
          conversationId: id,
          type: (payload.eventType as never) ?? "TOOL_CALL",
          agentSessionId: payload.agentSessionId ? String(payload.agentSessionId) : undefined,
          data: payload as object,
          model: payload.model ? String(payload.model) : undefined,
          latencyMs: typeof payload.latencyMs === "number" ? payload.latencyMs : undefined,
          inputTokens: typeof payload.inputTokens === "number" ? payload.inputTokens : undefined,
          outputTokens: typeof payload.outputTokens === "number" ? payload.outputTokens : undefined,
          estimatedCostUsd: typeof payload.estimatedCostUsd === "number" ? payload.estimatedCostUsd : undefined,
        },
      });
      return { status: 200, body: { ok: true } };
    }
    case "end_conversation": {
      const current = await prisma.conversation.findUnique({ where: { id } });
      if (current?.analysisStatus === "COMPLETED") return { status: 200, body: { ok: true } };
      const endedAt = new Date();
      const conversation = await prisma.conversation.update({
        where: { id },
        data: { status: "PROCESSING", endedAt, analysisStatus: "PENDING", reportStatus: "PENDING" },
      });
      await enqueueJob({
        type: "analysis.run",
        idempotencyKey: `analysis:${id}`,
        organizationId: conversation.organizationId,
        payload: { conversationId: id },
      });
      after(async () => {
        try {
          await processDueJobs();
        } catch (error) {
          console.error(error);
        }
      });
      return { status: 200, body: { ok: true } };
    }
    default:
      return { status: 400, body: { error: `Unknown tool ${tool}` } };
  }
}
