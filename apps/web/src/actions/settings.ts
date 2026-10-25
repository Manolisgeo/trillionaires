"use server";

import { prisma } from "@kimma/database";
import { requireOrg } from "@/server/org";
import { writeAudit } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const schema = z.object({
  name: z.string().min(2).max(80),
  retentionDays: z.coerce.number().int().min(7).max(3650),
  requireConsent: z.literal("on").optional(),
});

export async function updateOrganizationAction(formData: FormData) {
  const org = await requireOrg();
  if (org.role !== "OWNER" && org.role !== "ADMIN") {
    throw new Error("Only owners and admins can change organization settings.");
  }

  const parsed = schema.safeParse({
    name: formData.get("name"),
    retentionDays: formData.get("retentionDays"),
    requireConsent: formData.get("requireConsent"),
  });
  if (!parsed.success) {
    throw new Error("Check the settings and try again.");
  }

  await prisma.organization.update({
    where: { id: org.organizationId },
    data: {
      name: parsed.data.name,
      retentionDays: parsed.data.retentionDays,
      requireConsent: parsed.data.requireConsent === "on",
    },
  });

  await writeAudit({
    organizationId: org.organizationId,
    userId: org.userId,
    action: "organization.update",
    resourceType: "Organization",
    resourceId: org.organizationId,
    metadata: {
      retentionDays: parsed.data.retentionDays,
      requireConsent: parsed.data.requireConsent === "on",
    },
  });

  revalidatePath("/settings");
  revalidatePath("/");
}

export async function runRetentionAction() {
  const org = await requireOrg();
  if (org.role !== "OWNER" && org.role !== "ADMIN") {
    throw new Error("Only owners and admins can run retention.");
  }
  const { applyRetention } = await import("@/server/retention");
  await applyRetention();
  revalidatePath("/settings");
}
