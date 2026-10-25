import { NextResponse } from "next/server";
import { prisma } from "@kimma/database";
import { requireOrg } from "@/server/org";
import { writeAudit } from "@/server/audit";
import { loadOrCreateState } from "@/server/agent-runtime";
import {
  createParticipantToken,
  dispatchAgent,
  ensureRoom,
  livekitEnv,
  startRoomRecording,
} from "@/server/livekit";
import { rateLimit } from "@/server/redis";

export async function POST(request: Request) {
  const org = await requireOrg();
  const allowed = await rateLimit(`livekit:${org.userId}`, 30, 60);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const { conversationId } = (await request.json()) as { conversationId?: string };
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId required" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId: org.organizationId },
    include: { participants: true, organization: true, sessions: true },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const host = conversation.participants.find((p) => p.userId === org.userId);
  if (conversation.organization.requireConsent) {
    const pending = conversation.participants.filter(
      (p) => !p.isAgent && p.consentStatus !== "GRANTED",
    );
    if (pending.length > 0) {
      return NextResponse.json(
        { error: "Consent is required before joining this recorded conversation." },
        { status: 403 },
      );
    }
  }

  await ensureRoom(
    conversation.livekitRoom,
    JSON.stringify({ conversationId: conversation.id, organizationId: org.organizationId }),
  );

  const session =
    conversation.sessions.find((s) => !s.endedAt) ??
    (await prisma.conversationSession.create({
      data: { conversationId: conversation.id, livekitRoom: conversation.livekitRoom },
    }));

  if (conversation.status === "DRAFT" || conversation.status === "SCHEDULED") {
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "LIVE", startedAt: conversation.startedAt ?? new Date() },
    });
  }

  const objectKey = `${org.organizationId}/${conversation.id}/${session.id}.mp4`;
  const egressId = await startRoomRecording({
    roomName: conversation.livekitRoom,
    objectKey,
  });
  if (egressId) {
    await prisma.recording.create({
      data: {
        conversationId: conversation.id,
        organizationId: org.organizationId,
        objectKey,
        egressId,
        status: "RECORDING",
      },
    });
    await prisma.conversationEvent.create({
      data: {
        conversationId: conversation.id,
        type: "RECORDING_STARTED",
        data: { egressId, objectKey },
      },
    });
  }

  await dispatchAgent(
    conversation.livekitRoom,
    JSON.stringify({
      conversationId: conversation.id,
      sessionId: session.id,
      purpose: conversation.purpose,
    }),
  );

  await loadOrCreateState(conversation.id);

  const identity = host?.identity ?? `user-${org.userId}`;
  const token = await createParticipantToken({
    identity,
    name: org.name,
    roomName: conversation.livekitRoom,
    metadata: JSON.stringify({ userId: org.userId, role: "HOST" }),
  });

  await writeAudit({
    organizationId: org.organizationId,
    userId: org.userId,
    action: "conversation.join",
    resourceType: "Conversation",
    resourceId: conversation.id,
  });

  return NextResponse.json({
    serverUrl: livekitEnv().url,
    roomName: conversation.livekitRoom,
    participantToken: token,
    participantName: org.name,
    conversationId: conversation.id,
  });
}
