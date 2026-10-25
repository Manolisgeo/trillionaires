import { auth } from "@/auth";
import { prisma } from "@kimma/database";

export class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function requireOrg() {
  const session = await auth();
  if (!session?.user?.id || !session.user.organizationId) {
    throw new HttpError("Unauthorized", 401);
  }
  return {
    userId: session.user.id,
    organizationId: session.user.organizationId,
    role: session.user.organizationRole,
    name: session.user.name ?? "You",
    email: session.user.email ?? "",
  };
}

export async function orgConversation(organizationId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, organizationId },
  });
  if (!conversation) {
    throw new HttpError("Conversation not found", 404);
  }
  return conversation;
}
