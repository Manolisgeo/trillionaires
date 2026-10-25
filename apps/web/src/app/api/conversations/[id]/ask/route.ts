import { NextResponse } from "next/server";
import { prisma } from "@kimma/database";
import { answerFromTranscript } from "@kimma/conversation";
import { requireOrg } from "@/server/org";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const org = await requireOrg();
  const { id } = await context.params;
  const body = (await request.json()) as { question?: string };
  const question = body.question?.trim() ?? "";
  if (question.length < 2) {
    return NextResponse.json({ error: "Ask a longer question." }, { status: 400 });
  }

  const conversation = await prisma.conversation.findFirst({
    where: { id, organizationId: org.organizationId },
    include: { transcript: { include: { segments: { orderBy: { startTime: "asc" } } } } },
  });
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const result = answerFromTranscript(
    question,
    (conversation.transcript?.segments ?? [])
      .filter((segment) => segment.isFinal)
      .map((segment) => ({
        speakerName: segment.speakerName,
        text: segment.text,
        startTime: segment.startTime,
        endTime: segment.endTime,
        category: segment.category,
      })),
  );

  return NextResponse.json(result);
}
