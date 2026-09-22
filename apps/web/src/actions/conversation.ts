"use server";

import { prisma } from "@aperture/database";
import { templateByType } from "@aperture/conversation";
import type { ConversationType } from "@aperture/types";
import { requireOrg } from "@/server/org";
import { writeAudit } from "@/server/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(2).max(120),
  type: z.enum(["INTERVIEW", "SALES", "RESEARCH", "MEETING", "EXPERT_INTERVIEW", "CUSTOM"]),
  purpose: z.string().min(8).max(2000),
  objectives: z.string().min(2).max(4000),
  participantName: z.string().min(1).max(80),
});

export async function createConversationAction(formData: FormData) {
  const org = await requireOrg();
  const parsed = createSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    purpose: formData.get("purpose"),
    objectives: formData.get("objectives"),
    participantName: formData.get("participantName"),
  });
  if (!parsed.success) {
    throw new Error("Check the conversation fields and try again.");
  }

  const type = parsed.data.type as ConversationType;
  const template = templateByType(type);
  const objectiveLines = parsed.data.objectives
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let person = await prisma.person.findFirst({
    where: { organizationId: org.organizationId, name: parsed.data.participantName },
  });
  if (!person) {
    person = await prisma.person.create({
      data: {
        organizationId: org.organizationId,
        name: parsed.data.participantName,
      },
    });
  }

  const conversation = await prisma.conversation.create({
    data: {
      organizationId: org.organizationId,
      createdById: org.userId,
      type,
      title: parsed.data.title,
      purpose: parsed.data.purpose,
      livekitRoom: `aperture-${crypto.randomUUID()}`,
      status: "DRAFT",
      metadata: { template: template.name },
      participants: {
        create: [
          {
            displayName: org.name,
            role: "HOST",
            identity: `user-${org.userId}`,
            userId: org.userId,
            consentStatus: "GRANTED",
            consentedAt: new Date(),
          },
          {
            displayName: parsed.data.participantName,
            role: "PARTICIPANT",
            identity: `guest-${crypto.randomUUID()}`,
            personId: person.id,
            consentStatus: "PENDING",
          },
          {
            displayName: "Aperture",
            role: "AI_AGENT",
            identity: "aperture-agent",
            isAgent: true,
            consentStatus: "GRANTED",
            consentedAt: new Date(),
          },
        ],
      },
      objectives: {
        create: objectiveLines.map((title, index) => ({
          title,
          description: title,
          importance: 0.8,
          sortOrder: index,
        })),
      },
      criteria: {
        create: objectiveLines.map((title, index) => ({
          title,
          description: title,
          weight: 0.8,
          strongAnchor:
            "A concrete example with a metric, an owner, and a tradeoff the speaker can defend.",
          weakAnchor: "A generic claim with no example, number, or owner.",
          sortOrder: index,
        })),
      },
      questions: {
        create: template.questions.map((question, index) => ({
          prompt: question.prompt,
          expectedEvidence: question.expectedEvidence,
          importance: question.importance,
          difficulty: question.difficulty,
          prerequisites: question.prerequisites,
          followUpIds: question.followUpIds,
          sortOrder: index,
        })),
      },
    },
  });

  await writeAudit({
    organizationId: org.organizationId,
    userId: org.userId,
    action: "conversation.create",
    resourceType: "Conversation",
    resourceId: conversation.id,
  });

  revalidatePath("/conversations");
  revalidatePath("/people");
  redirect(`/conversations/${conversation.id}`);
}

export async function grantConsentAction(conversationId: string) {
  const org = await requireOrg();
  await prisma.conversationParticipant.updateMany({
    where: {
      conversationId,
      conversation: { organizationId: org.organizationId },
      isAgent: false,
    },
    data: { consentStatus: "GRANTED", consentedAt: new Date() },
  });
  await prisma.conversationEvent.create({
    data: {
      conversationId,
      type: "CONSENT",
      data: { userId: org.userId, status: "GRANTED" },
    },
  });
  await writeAudit({
    organizationId: org.organizationId,
    userId: org.userId,
    action: "conversation.consent",
    resourceType: "Conversation",
    resourceId: conversationId,
  });
  revalidatePath(`/conversations/${conversationId}`);
}

export async function deleteConversationAction(conversationId: string) {
  const org = await requireOrg();
  await prisma.conversation.deleteMany({
    where: { id: conversationId, organizationId: org.organizationId },
  });
  await writeAudit({
    organizationId: org.organizationId,
    userId: org.userId,
    action: "conversation.delete",
    resourceType: "Conversation",
    resourceId: conversationId,
  });
  revalidatePath("/conversations");
  redirect("/conversations");
}
