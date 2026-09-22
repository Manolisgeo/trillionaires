import { prisma } from "@aperture/database";
import { draftScorecard, matchTrackers, type DraftRating } from "@aperture/conversation";

function evidenceBundle(draft: DraftRating) {
  return {
    confidence: draft.confidence,
    observation: draft.observation,
    interpretation: draft.interpretation,
    support: draft.quotes,
    counter: draft.counterQuotes,
  };
}

const STRONG =
  "A concrete example with a metric, an owner, and a tradeoff the speaker can defend.";
const WEAK = "A generic claim with no example, number, or owner.";

export async function ensureCriteria(conversationId: string) {
  const existing = await prisma.rubricCriterion.count({ where: { conversationId } });
  if (existing > 0) return;

  const objectives = await prisma.conversationObjective.findMany({
    where: { conversationId },
    orderBy: { sortOrder: "asc" },
  });

  if (objectives.length === 0) return;

  await prisma.rubricCriterion.createMany({
    data: objectives.map((objective) => ({
      conversationId,
      title: objective.title,
      description: objective.description,
      weight: objective.importance,
      strongAnchor: STRONG,
      weakAnchor: WEAK,
      sortOrder: objective.sortOrder,
    })),
  });
}

export async function refreshScorecard(conversationId: string) {
  await ensureCriteria(conversationId);
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      criteria: { include: { rating: true }, orderBy: { sortOrder: "asc" } },
      transcript: { include: { segments: { orderBy: { startTime: "asc" } } } },
    },
  });
  if (!conversation) return;

  const lines = (conversation.transcript?.segments ?? [])
    .filter((segment) => segment.isFinal && segment.speakerName !== "Aperture")
    .map((segment) => ({
      speakerName: segment.speakerName,
      text: segment.text,
      startTime: segment.startTime,
      endTime: segment.endTime,
      category: segment.category,
    }));

  const drafts = draftScorecard(
    conversation.criteria.map((criterion) => ({
      id: criterion.id,
      title: criterion.title,
      description: criterion.description,
    })),
    lines,
  );

  for (const draft of drafts) {
    const current = conversation.criteria.find((criterion) => criterion.id === draft.criterionId)?.rating;
    if (current?.source === "HUMAN") continue;
    await prisma.scorecardRating.upsert({
      where: { criterionId: draft.criterionId },
      create: {
        criterionId: draft.criterionId,
        conversationId,
        organizationId: conversation.organizationId,
        score: null,
        rationale: draft.interpretation,
        evidenceKind: draft.evidenceKind,
        source: "DRAFT",
        quotes: evidenceBundle(draft),
      },
      update: {
        score: null,
        rationale: draft.interpretation,
        evidenceKind: draft.evidenceKind,
        source: "DRAFT",
        quotes: evidenceBundle(draft),
      },
    });
  }
}

export async function refreshTrackerHits(conversationId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { transcript: { include: { segments: true } } },
  });
  if (!conversation) return;

  const trackers = await prisma.tracker.findMany({
    where: {
      OR: [{ organizationId: null, isBuiltin: true }, { organizationId: conversation.organizationId }],
    },
  });

  const lines = (conversation.transcript?.segments ?? [])
    .filter((segment) => segment.isFinal)
    .map((segment) => ({
      speakerName: segment.speakerName,
      text: segment.text,
      startTime: segment.startTime,
      endTime: segment.endTime,
      category: segment.category,
    }));

  const hits = matchTrackers(
    trackers.map((tracker) => ({
      id: tracker.id,
      name: tracker.name,
      phrases: Array.isArray(tracker.phrases) ? (tracker.phrases as string[]) : [],
    })),
    lines,
  );

  await prisma.trackerHit.deleteMany({ where: { conversationId } });
  if (hits.length === 0) return;
  await prisma.trackerHit.createMany({
    data: hits.map((hit) => ({
      trackerId: hit.trackerId,
      conversationId,
      organizationId: conversation.organizationId,
      startTime: hit.startTime,
      speakerName: hit.speakerName,
      excerpt: hit.excerpt,
    })),
  });
}
