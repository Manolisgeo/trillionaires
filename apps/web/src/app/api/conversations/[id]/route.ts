import { NextResponse } from "next/server";
import { prisma } from "@kimma/database";
import { requireOrg } from "@/server/org";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const org = await requireOrg();
  const { id } = await context.params;
  const conversation = await prisma.conversation.findFirst({
    where: { id, organizationId: org.organizationId },
    include: {
      transcript: { include: { segments: { orderBy: { startTime: "asc" } } } },
    },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    status: conversation.status,
    analysisStatus: conversation.analysisStatus,
    reportStatus: conversation.reportStatus,
    segments: conversation.transcript?.segments ?? [],
  });
}
