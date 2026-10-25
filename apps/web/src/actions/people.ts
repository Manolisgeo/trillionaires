"use server";

import { prisma } from "@kimma/database";
import { requireOrg } from "@/server/org";
import { writeAudit } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const outcomeSchema = z.object({
  personId: z.string().min(1),
  decision: z.enum(["ADVANCED", "HIRED", "NOT_SELECTED", "NO_DECISION"]),
  note: z.string().max(500).optional(),
});

const relationshipSchema = z.object({
  personId: z.string().min(1),
  otherName: z.string().min(2).max(80),
  kind: z.enum(["MANAGER", "REPORT", "COLLEAGUE", "CUSTOMER", "OTHER"]),
  note: z.string().max(240).optional(),
});

export async function recordOutcomeAction(formData: FormData) {
  const org = await requireOrg();
  const parsed = outcomeSchema.safeParse({
    personId: formData.get("personId"),
    decision: formData.get("decision"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) throw new Error("Choose an outcome a person actually recorded.");

  const person = await prisma.person.findFirst({
    where: { id: parsed.data.personId, organizationId: org.organizationId },
  });
  if (!person) throw new Error("Person not found.");

  await prisma.personOutcome.create({
    data: {
      organizationId: org.organizationId,
      personId: person.id,
      decision: parsed.data.decision,
      note: parsed.data.note ?? "",
      recordedById: org.userId,
    },
  });
  await writeAudit({
    organizationId: org.organizationId,
    userId: org.userId,
    action: "person.outcome",
    resourceType: "Person",
    resourceId: person.id,
    metadata: { decision: parsed.data.decision },
  });
  revalidatePath(`/people/${person.id}`);
}

export async function addRelationshipAction(formData: FormData) {
  const org = await requireOrg();
  const parsed = relationshipSchema.safeParse({
    personId: formData.get("personId"),
    otherName: formData.get("otherName"),
    kind: formData.get("kind"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) throw new Error("Name the other person and the relationship.");

  const person = await prisma.person.findFirst({
    where: { id: parsed.data.personId, organizationId: org.organizationId },
  });
  if (!person) throw new Error("Person not found.");

  await prisma.personRelationship.create({
    data: {
      organizationId: org.organizationId,
      personId: person.id,
      otherName: parsed.data.otherName,
      kind: parsed.data.kind,
      note: parsed.data.note ?? "",
    },
  });
  revalidatePath(`/people/${person.id}`);
}
