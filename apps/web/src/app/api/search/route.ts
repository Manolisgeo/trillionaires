import { NextResponse } from "next/server";
import { prisma } from "@aperture/database";
import { requireOrg } from "@/server/org";
import { searchConversations } from "@/server/analysis";

export async function GET(request: Request) {
  const org = await requireOrg();
  const query = new URL(request.url).searchParams.get("q") ?? "";
  const trimmed = query.trim();

  const [semantic, keywordHits, titled] = await Promise.all([
    searchConversations({ organizationId: org.organizationId, query: trimmed }),
    trimmed
      ? prisma.transcriptSegment.findMany({
          where: {
            text: { contains: trimmed, mode: "insensitive" },
            transcript: { conversation: { organizationId: org.organizationId } },
          },
          take: 30,
          include: {
            transcript: {
              select: {
                conversationId: true,
                conversation: { select: { title: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    trimmed
      ? prisma.conversation.findMany({
          where: {
            organizationId: org.organizationId,
            OR: [
              { title: { contains: trimmed, mode: "insensitive" } },
              { purpose: { contains: trimmed, mode: "insensitive" } },
            ],
          },
          take: 10,
          select: { id: true, title: true, purpose: true },
        })
      : Promise.resolve([]),
  ]);

  const seen = new Set(semantic.map((hit) => hit.conversationId));
  const merged = [
    ...semantic,
    ...titled
      .filter((row) => !seen.has(row.id))
      .map((row) => ({
        conversationId: row.id,
        score: 0.5,
        snippet: row.purpose,
        title: row.title,
      })),
  ];

  return NextResponse.json({ semantic: merged, keywordHits });
}
