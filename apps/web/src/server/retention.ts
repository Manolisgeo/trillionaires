import { prisma } from "@aperture/database";
import { writeAudit } from "@/server/audit";

/**
 * Past the org retention window, transcripts, search text, and recording rows are removed.
 * The conversation title and extracted claims stay so person memory is not silently erased.
 */
export async function applyRetention(): Promise<number> {
  const organizations = await prisma.organization.findMany({
    select: { id: true, retentionDays: true },
  });
  let archived = 0;

  for (const organization of organizations) {
    const cutoff = new Date(Date.now() - organization.retentionDays * 24 * 60 * 60 * 1000);
    const due = await prisma.conversation.findMany({
      where: {
        organizationId: organization.id,
        archivedAt: null,
        createdAt: { lt: cutoff },
        status: { in: ["PROCESSING", "FAILED", "COMPLETED"] },
      },
      select: { id: true, title: true },
    });

    for (const conversation of due) {
      await prisma.transcriptSegment.deleteMany({
        where: { transcript: { conversationId: conversation.id } },
      });
      await prisma.searchDocument.deleteMany({ where: { conversationId: conversation.id } });
      await prisma.recording.deleteMany({ where: { conversationId: conversation.id } });
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { archivedAt: new Date(), recordingUrl: null, transcriptStatus: "COMPLETED" },
      });
      await writeAudit({
        organizationId: organization.id,
        action: "retention.archive",
        resourceType: "Conversation",
        resourceId: conversation.id,
        metadata: { title: conversation.title },
      });
      archived += 1;
    }
  }

  return archived;
}
