import { NextResponse } from "next/server";
import { prisma } from "@aperture/database";
import { requireOrg } from "@/server/org";
import { writeAudit } from "@/server/audit";
import { runAnalysisPipeline } from "@/server/analysis";
import { after } from "next/server";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const org = await requireOrg();
  const { id } = await context.params;
  const conversation = await prisma.conversation.findFirst({
    where: { id, organizationId: org.organizationId },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const endedAt = new Date();
  const durationSeconds = conversation.startedAt
    ? Math.round((endedAt.getTime() - conversation.startedAt.getTime()) / 1000)
    : null;

  await prisma.conversation.update({
    where: { id },
    data: {
      status: "PROCESSING",
      endedAt,
      durationSeconds,
      analysisStatus: "PENDING",
      reportStatus: "PENDING",
    },
  });
  await prisma.conversationSession.updateMany({
    where: { conversationId: id, endedAt: null },
    data: { endedAt },
  });
  await prisma.conversationEvent.create({
    data: { conversationId: id, type: "SESSION_ENDED", data: { userId: org.userId } },
  });
  await writeAudit({
    organizationId: org.organizationId,
    userId: org.userId,
    action: "conversation.end",
    resourceType: "Conversation",
    resourceId: id,
  });

  after(async () => {
    try {
      await runAnalysisPipeline(id);
    } catch (error) {
      console.error("Analysis failed", error);
      await prisma.conversation.update({
        where: { id },
        data: { analysisStatus: "FAILED", reportStatus: "FAILED", status: "FAILED" },
      });
    }
  });

  return NextResponse.json({ ok: true, status: "PROCESSING" });
}
