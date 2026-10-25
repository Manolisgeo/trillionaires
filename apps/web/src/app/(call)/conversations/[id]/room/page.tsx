import { prisma } from "@kimma/database";
import { requireOrg } from "@/server/org";
import { notFound } from "next/navigation";
import { CallRoom } from "@/components/call/call-room";

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const org = await requireOrg();
  const { id } = await params;
  const conversation = await prisma.conversation.findFirst({
    where: { id, organizationId: org.organizationId },
  });
  if (!conversation) notFound();

  return <CallRoom conversationId={conversation.id} title={conversation.title} />;
}
