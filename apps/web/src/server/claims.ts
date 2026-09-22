import { prisma } from "@aperture/database";
import { extractClaims } from "@aperture/intelligence";

export async function persistClaims(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      objectives: true,
      participants: true,
      transcript: { include: { segments: { orderBy: { startTime: "asc" } } } },
    },
  });
  if (!conversation) return;

  const lines = (conversation.transcript?.segments ?? [])
    .filter((segment) => segment.isFinal)
    .map((segment) => ({
      speakerName: segment.speakerName,
      text: segment.text,
      startTime: segment.startTime,
      endTime: segment.endTime,
      isAgent: segment.speakerName === "Aperture" || /aperture/i.test(segment.speakerName),
    }));

  const speaker = conversation.participants.find((participant) => participant.personId);
  const extracted = extractClaims(
    lines,
    conversation.objectives.map((objective) => ({
      title: objective.title,
      text: objective.description,
    })),
  );

  await prisma.claim.deleteMany({ where: { conversationId } });
  for (const claim of extracted) {
    await prisma.claim.create({
      data: {
        organizationId: conversation.organizationId,
        personId: speaker?.personId,
        conversationId,
        topic: claim.topic,
        observation: claim.observation,
        interpretation: claim.interpretation,
        confidence: claim.confidence,
        speakerName: claim.speakerName,
        evidence: {
          create: claim.evidence.map((item) => ({
            organizationId: conversation.organizationId,
            conversationId,
            role: item.role,
            speakerName: item.speakerName,
            quote: item.quote,
            startTime: item.startTime,
            endTime: item.endTime,
          })),
        },
      },
    });
  }
}
