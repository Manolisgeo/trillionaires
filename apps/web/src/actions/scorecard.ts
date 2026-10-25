"use server";

import { prisma } from "@kimma/database";
import { requireOrg } from "@/server/org";
import { writeAudit } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const rateSchema = z.object({
  criterionId: z.string().min(1),
  score: z.coerce.number().int().min(1).max(4),
});

export async function rateCriterionAction(formData: FormData) {
  const org = await requireOrg();
  const parsed = rateSchema.safeParse({
    criterionId: formData.get("criterionId"),
    score: formData.get("score"),
  });
  if (!parsed.success) throw new Error("Choose a rating from 1 to 4.");

  const criterion = await prisma.rubricCriterion.findFirst({
    where: {
      id: parsed.data.criterionId,
      conversation: { organizationId: org.organizationId },
    },
    include: { rating: true },
  });
  if (!criterion) throw new Error("Criterion not found.");

  const quotes = criterion.rating?.quotes ?? [];
  await prisma.scorecardRating.upsert({
    where: { criterionId: criterion.id },
    create: {
      criterionId: criterion.id,
      conversationId: criterion.conversationId,
      organizationId: org.organizationId,
      score: parsed.data.score,
      rationale: `Reviewed by ${org.name}. The quotes below are still the evidence.`,
      evidenceKind: criterion.rating?.evidenceKind ?? "UNCERTAINTY",
      source: "HUMAN",
      quotes,
    },
    update: {
      score: parsed.data.score,
      source: "HUMAN",
      rationale: criterion.rating?.rationale ?? `Reviewed by ${org.name}.`,
    },
  });

  await writeAudit({
    organizationId: org.organizationId,
    userId: org.userId,
    action: "scorecard.rate",
    resourceType: "RubricCriterion",
    resourceId: criterion.id,
    metadata: { score: parsed.data.score },
  });

  revalidatePath(`/conversations/${criterion.conversationId}`);
  revalidatePath(`/conversations/${criterion.conversationId}/report`);
}

const trackerSchema = z.object({
  name: z.string().min(2).max(60),
  phrases: z.string().min(2).max(400),
});

export async function createTrackerAction(formData: FormData) {
  const org = await requireOrg();
  if (org.role !== "OWNER" && org.role !== "ADMIN") {
    throw new Error("Only owners and admins can add trackers.");
  }
  const parsed = trackerSchema.safeParse({
    name: formData.get("name"),
    phrases: formData.get("phrases"),
  });
  if (!parsed.success) throw new Error("Name the tracker and add at least one phrase.");

  const phrases = parsed.data.phrases
    .split(",")
    .map((phrase) => phrase.trim().toLowerCase())
    .filter((phrase) => phrase.length > 1);

  if (phrases.length === 0) throw new Error("Add comma-separated phrases.");

  await prisma.tracker.create({
    data: {
      organizationId: org.organizationId,
      name: parsed.data.name,
      description: "Custom tracker for this organization.",
      phrases,
      isBuiltin: false,
    },
  });

  await writeAudit({
    organizationId: org.organizationId,
    userId: org.userId,
    action: "tracker.create",
    resourceType: "Tracker",
    metadata: { name: parsed.data.name },
  });

  revalidatePath("/signals");
  revalidatePath("/settings");
}
