import { prisma } from "@kimma/database";

export async function writeAudit(input: {
  organizationId: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
}) {
  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: input.metadata as object | undefined,
      ip: input.ip,
    },
  });
}
