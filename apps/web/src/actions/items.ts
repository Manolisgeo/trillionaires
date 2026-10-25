"use server";

import { prisma } from "@kimma/database";
import { requireOrg } from "@/server/org";
import { writeAudit } from "@/server/audit";
import { revalidatePath } from "next/cache";

export async function toggleActionItemAction(itemId: string, completed: boolean) {
  const org = await requireOrg();
  const item = await prisma.actionItem.findFirst({
    where: { id: itemId, organizationId: org.organizationId },
  });
  if (!item) throw new Error("Action item not found.");

  await prisma.actionItem.update({
    where: { id: item.id },
    data: { completed },
  });
  await writeAudit({
    organizationId: org.organizationId,
    userId: org.userId,
    action: completed ? "action.complete" : "action.reopen",
    resourceType: "ActionItem",
    resourceId: item.id,
  });
  revalidatePath("/");
  revalidatePath(`/conversations/${item.conversationId}`);
}
