import { extractClaims } from "@kimma/intelligence";
import type { PrismaClient } from "@prisma/client";

const DEMO_KEY = "demo-backend-screen";

export async function seedDemoConversation(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
) {
  const existing = await prisma.conversation.findFirst({
    where: { organizationId: orgId, livekitRoom: `kimma-demo-${DEMO_KEY}` },
  });

  const person = await prisma.person.upsert({
    where: { id: `demo-person-${orgId}` },
    update: { name: "Jordan Hale", title: "Staff backend engineer", email: "jordan.hale@example.com" },
    create: {
      id: `demo-person-${orgId}`,
      organizationId: orgId,
      name: "Jordan Hale",
      email: "jordan.hale@example.com",
      title: "Staff backend engineer",
    },
  });

  if (existing) {
    await prisma.conversationParticipant.updateMany({
      where: { conversationId: existing.id, identity: "guest-jordan-hale" },
      data: { personId: person.id },
    });
    const report = await prisma.report.findUnique({ where: { conversationId: existing.id } });
    if (report) {
      await prisma.reportSection.createMany({
        skipDuplicates: true,
        data: [
          {
            reportId: report.id,
            key: "decisions",
            title: "Decisions",
            sortOrder: 3,
            body: "None recorded. This was an evaluative conversation, not a decision meeting.",
          },
          {
            reportId: report.id,
            key: "action_items",
            title: "Action Items",
            sortOrder: 4,
            body: "- Jordan to send the postmortem and load-test notes. Owner: Jordan Hale. [24:40]",
          },
          {
            reportId: report.id,
            key: "questions_raised",
            title: "Questions Raised",
            sortOrder: 5,
            body: "- What was time-to-detect on the replica lag incident?\n- What was customer-visible impact?\n- What changed in the operating model after the postmortem?",
          },
          {
            reportId: report.id,
            key: "topics",
            title: "Topics Discussed",
            sortOrder: 8,
            body: "- Catalog service design (PostgreSQL, replicas)\n- Load and latency evidence\n- Replica-lag incident and consistency model\n- Follow-up artifacts (postmortem, load-test notes)",
          },
        ],
      });
    }
    await attachDemoScorecard(prisma, existing.id, orgId);
    await attachDemoClaims(prisma, existing.id, orgId);
    return existing.id;
  }

  const startedAt = new Date("2026-09-18T15:00:00.000Z");
  const endedAt = new Date("2026-09-18T15:34:00.000Z");

  const conversation = await prisma.conversation.create({
    data: {
      organizationId: orgId,
      createdById: userId,
      type: "INTERVIEW",
      title: "Staff backend screen · Jordan Hale",
      purpose: "Evaluate backend engineering ability for a production role.",
      status: "COMPLETED",
      startedAt,
      endedAt,
      durationSeconds: 34 * 60,
      livekitRoom: `kimma-demo-${DEMO_KEY}`,
      transcriptStatus: "COMPLETED",
      analysisStatus: "COMPLETED",
      reportStatus: "COMPLETED",
      metadata: { demoKey: DEMO_KEY, demo: true },
      participants: {
        create: [
          {
            displayName: "Founder",
            role: "HOST",
            identity: `user-${userId}`,
            userId,
            consentStatus: "GRANTED",
            consentedAt: startedAt,
          },
          {
            displayName: "Jordan Hale",
            role: "PARTICIPANT",
            identity: "guest-jordan-hale",
            personId: person.id,
            consentStatus: "GRANTED",
            consentedAt: startedAt,
          },
          {
            displayName: "Kimma",
            role: "AI_AGENT",
            identity: "kimma-agent",
            isAgent: true,
            consentStatus: "GRANTED",
            consentedAt: startedAt,
          },
        ],
      },
      objectives: {
        create: [
          {
            title: "Backend engineering ability",
            description: "Can they design, operate, and debug backend systems?",
            importance: 0.95,
            status: "COVERED",
            sortOrder: 0,
          },
          {
            title: "Production ownership",
            description: "Have they owned systems under real load and failure?",
            importance: 0.85,
            status: "PARTIAL",
            sortOrder: 1,
          },
          {
            title: "Communication",
            description: "Can they explain tradeoffs clearly?",
            importance: 0.7,
            status: "COVERED",
            sortOrder: 2,
          },
        ],
      },
    },
  });

  const transcript = await prisma.transcript.create({
    data: { conversationId: conversation.id, status: "COMPLETED", language: "en" },
  });

  const segments: Array<{
    speakerName: string;
    text: string;
    startTime: number;
    endTime: number;
    category:
      | "KEY_FACT"
      | "DECISION"
      | "ACTION"
      | "INSIGHT"
      | "CONCERN"
      | "CONTRADICTION"
      | "QUESTION"
      | "BACKGROUND"
      | "LOW_VALUE";
    importanceScore: number;
    importanceReason: string;
  }> = [
    {
      speakerName: "Kimma",
      text: "I'm an AI participant. This conversation is recorded. I want to understand how you design and operate backend systems. Tell me about a service you designed and the tradeoffs you made.",
      startTime: 12,
      endTime: 24,
      category: "QUESTION",
      importanceScore: 0.6,
      importanceReason: "Opening objective",
    },
    {
      speakerName: "Jordan Hale",
      text: "I designed a catalog service on PostgreSQL. We needed read throughput, so I split reads onto replicas and kept writes on the primary. At the time I said it was strongly consistent because writes went to one primary.",
      startTime: 28,
      endTime: 52,
      category: "KEY_FACT",
      importanceScore: 0.9,
      importanceReason: "Concrete system design claim",
    },
    {
      speakerName: "Kimma",
      text: "What load did it handle, and how did you know the limits?",
      startTime: 56,
      endTime: 62,
      category: "QUESTION",
      importanceScore: 0.62,
      importanceReason: "Follow-up on evidence",
    },
    {
      speakerName: "Jordan Hale",
      text: "Peak was about 100,000 requests per second on the read path. p99 stayed under 80 milliseconds as long as we didn't fan out. We found the ceiling in a load test, not in production.",
      startTime: 68,
      endTime: 92,
      category: "KEY_FACT",
      importanceScore: 0.92,
      importanceReason: "Concrete metric",
    },
    {
      speakerName: "Kimma",
      text: "Walk me through a production failure you were involved in.",
      startTime: 210,
      endTime: 216,
      category: "QUESTION",
      importanceScore: 0.7,
      importanceReason: "Uncovered objective",
    },
    {
      speakerName: "Jordan Hale",
      text: "A replica fell behind during a migration. Reads started serving stale prices. I misspoke earlier — that path was eventually consistent. We added lag alerts and a primary fallback. I owned the postmortem.",
      startTime: 222,
      endTime: 258,
      category: "CONTRADICTION",
      importanceScore: 0.94,
      importanceReason: "Revised consistency model plus incident ownership",
    },
    {
      speakerName: "Kimma",
      text: "Earlier you described the service as strongly consistent, and just now as eventually consistent. Can you reconcile those?",
      startTime: 262,
      endTime: 274,
      category: "QUESTION",
      importanceScore: 0.88,
      importanceReason: "Contradiction follow-up",
    },
    {
      speakerName: "Jordan Hale",
      text: "Writes to the primary were linearizable. Replica reads were eventually consistent. I should have said that up front. The tradeoff was stale reads versus load on the primary.",
      startTime: 278,
      endTime: 302,
      category: "INSIGHT",
      importanceScore: 0.86,
      importanceReason: "Clear tradeoff after clarification",
    },
    {
      speakerName: "Jordan Hale",
      text: "I'll send the postmortem and the load-test notes after this.",
      startTime: 1480,
      endTime: 1488,
      category: "ACTION",
      importanceScore: 0.78,
      importanceReason: "Commitment",
    },
  ];

  await prisma.transcriptSegment.createMany({
    data: segments.map((segment) => ({
      transcriptId: transcript.id,
      speakerId: segment.speakerName === "Kimma" ? "kimma-agent" : "guest-jordan-hale",
      speakerName: segment.speakerName,
      text: segment.text,
      startTime: segment.startTime,
      endTime: segment.endTime,
      confidence: 0.94,
      isFinal: true,
      category: segment.category,
      importanceScore: segment.importanceScore,
      importanceReason: segment.importanceReason,
    })),
  });

  const report = await prisma.report.create({
    data: {
      conversationId: conversation.id,
      status: "COMPLETED",
      executiveSummary:
        "Jordan described a catalog service on PostgreSQL with primary writes and replica reads, citing ~100k read QPS and p99 under 80ms from a load test. A later account of a replica-lag incident revised an earlier “strongly consistent” claim: writes were linearizable, replica reads were eventually consistent. Production ownership is evidenced by owning a postmortem, but the incident narrative is still thin on detection time and customer impact. Communication improved after a direct contradiction follow-up. This is an evidence report, not a hiring decision.",
    },
  });

  await prisma.reportSection.createMany({
    data: [
      {
        reportId: report.id,
        key: "key_takeaways",
        title: "Key Takeaways",
        sortOrder: 1,
        body: "- Designed a PostgreSQL catalog service with primary writes and replica reads.\n- Claimed ~100k read requests/sec with p99 < 80ms, measured in a load test.\n- Initially described the system as strongly consistent; later clarified replica reads as eventually consistent.\n- Owned a replica-lag incident postmortem; customer impact and time-to-detect were not established.",
      },
      {
        reportId: report.id,
        key: "important_moments",
        title: "Important Moments",
        sortOrder: 2,
        body: "- [00:28] System design and original consistency claim\n- [01:08] 100k QPS and latency numbers\n- [03:42] Replica lag incident; consistency model revised\n- [04:38] Tradeoff restated clearly after follow-up\n- [24:40] Commitment to send artifacts",
      },
      {
        reportId: report.id,
        key: "decisions",
        title: "Decisions",
        sortOrder: 3,
        body: "None recorded. This was an evaluative conversation, not a decision meeting.",
      },
      {
        reportId: report.id,
        key: "action_items",
        title: "Action Items",
        sortOrder: 4,
        body: "- Jordan to send the postmortem and load-test notes. Owner: Jordan Hale. [24:40]",
      },
      {
        reportId: report.id,
        key: "questions_raised",
        title: "Questions Raised",
        sortOrder: 5,
        body: "- What was time-to-detect on the replica lag incident?\n- What was customer-visible impact?\n- What changed in the operating model after the postmortem?",
      },
      {
        reportId: report.id,
        key: "contradictions",
        title: "Contradictions / Inconsistencies",
        sortOrder: 6,
        body: "- Consistency model [03:42]: “strongly consistent because writes went to one primary” vs “that path was eventually consistent.” Later reconciled: writes linearizable, replica reads eventual.",
      },
      {
        reportId: report.id,
        key: "evidence",
        title: "Evidence",
        sortOrder: 7,
        body: "- [FACT] PostgreSQL catalog service with replicas. Excerpt: “I designed a catalog service on PostgreSQL.” [00:28]\n- [FACT] ~100k read QPS, p99 < 80ms in a load test. [01:08]\n- [FACT] Replica lag served stale prices. [03:42]\n- [INFERENCE] Comfortable explaining tradeoffs once challenged.\n- [UNCERTAINTY] Depth of on-call ownership and incident metrics not established.",
      },
      {
        reportId: report.id,
        key: "topics",
        title: "Topics Discussed",
        sortOrder: 8,
        body: "- Catalog service design (PostgreSQL, replicas)\n- Load and latency evidence\n- Replica-lag incident and consistency model\n- Follow-up artifacts (postmortem, load-test notes)",
      },
      {
        reportId: report.id,
        key: "detailed_analysis",
        title: "Detailed Analysis",
        sortOrder: 9,
        body: "Against the stated purpose — evaluate backend engineering ability — Jordan supplied concrete design, a metric, and a production incident. The most important moment was not the QPS number; it was the correction of the consistency model. That correction was prompted by the agent, not volunteered, which is useful signal about precision under follow-up.\n\nProduction ownership is only PARTIAL: a postmortem was owned, but detection, blast radius, and what changed in the operating model were not evidenced. Do not treat this report as a hire / no-hire recommendation.",
      },
    ],
  });

  await prisma.conversationInsight.createMany({
    data: [
      {
        conversationId: conversation.id,
        kind: "FACT",
        category: "KEY_FACT",
        title: "Catalog service on PostgreSQL with replica reads",
        body: "Primary writes, replica reads.",
        timestampSeconds: 28,
      },
      {
        conversationId: conversation.id,
        kind: "FACT",
        category: "KEY_FACT",
        title: "Claimed 100k read QPS, p99 under 80ms",
        body: "Measured in a load test, not production.",
        timestampSeconds: 68,
      },
      {
        conversationId: conversation.id,
        kind: "UNCERTAINTY",
        category: "CONTRADICTION",
        title: "Consistency model revised mid-conversation",
        body: "Strongly consistent → eventually consistent on the read path.",
        timestampSeconds: 222,
      },
      {
        conversationId: conversation.id,
        kind: "INFERENCE",
        category: "INSIGHT",
        title: "Clarified tradeoff after being challenged",
        body: "Writes linearizable; replica reads eventual.",
        timestampSeconds: 278,
      },
    ],
  });

  await prisma.actionItem.create({
    data: {
      conversationId: conversation.id,
      organizationId: orgId,
      text: "Jordan to send postmortem and load-test notes",
      owner: "Jordan Hale",
      timestampSeconds: 1480,
    },
  });

  await prisma.searchDocument.create({
    data: {
      organizationId: orgId,
      conversationId: conversation.id,
      chunkType: "CONVERSATION_SUMMARY",
      content:
        "Jordan Hale backend interview PostgreSQL catalog service 100k requests per second replica lag eventually consistent strongly consistent postmortem load test",
      metadata: { demo: true },
    },
  });

  await attachDemoScorecard(prisma, conversation.id, orgId);
  await attachDemoClaims(prisma, conversation.id, orgId);
  return conversation.id;
}

const STRONG =
  "A concrete example with a metric, an owner, and a tradeoff the speaker can defend.";
const WEAK = "A generic claim with no example, number, or owner.";

async function attachDemoScorecard(prisma: PrismaClient, conversationId: string, orgId: string) {
  const criteria: Array<{
    title: string;
    description: string;
    weight: number;
    sortOrder: number;
    score: null;
    evidenceKind: "FACT" | "INFERENCE" | "UNCERTAINTY";
    rationale: string;
    confidence: "DIRECT" | "REPEATED" | "CONTRADICTED" | "UNKNOWN";
    quotes: Array<{ speakerName: string; text: string; startTime: number }>;
    counter: Array<{ speakerName: string; text: string; startTime: number }>;
  }> = [
    {
      title: "Backend engineering ability",
      description: "Can they design, operate, and debug backend systems?",
      weight: 0.95,
      sortOrder: 0,
      score: null,
      evidenceKind: "FACT",
      confidence: "CONTRADICTED",
      rationale:
        "Potential contradiction. The design quote and the later consistency revision are both kept. Neither is treated as the true account.",
      counter: [
        {
          speakerName: "Jordan Hale",
          text: "I misspoke earlier — that path was eventually consistent. I owned the postmortem.",
          startTime: 222,
        },
      ],
      quotes: [
        {
          speakerName: "Jordan Hale",
          text: "I designed a catalog service on PostgreSQL. We needed read throughput, so I split reads onto replicas and kept writes on the primary.",
          startTime: 28,
        },
        {
          speakerName: "Jordan Hale",
          text: "Peak was about 100,000 requests per second on the read path. p99 stayed under 80 milliseconds.",
          startTime: 68,
        },
      ],
    },
    {
      title: "Production ownership",
      description: "Have they owned systems under real load and failure?",
      weight: 0.85,
      sortOrder: 1,
      score: null,
      evidenceKind: "UNCERTAINTY",
      confidence: "DIRECT",
      rationale: "One direct statement about owning the postmortem. That is evidence, not a rating.",
      counter: [],
      quotes: [
        {
          speakerName: "Jordan Hale",
          text: "A replica fell behind during a migration. Reads started serving stale prices. I owned the postmortem.",
          startTime: 222,
        },
      ],
    },
    {
      title: "Communication",
      description: "Can they explain tradeoffs clearly?",
      weight: 0.7,
      sortOrder: 2,
      score: null,
      evidenceKind: "INFERENCE",
      confidence: "DIRECT",
      rationale: "One direct explanation of the tradeoff. The interpretation is that it was clear. The quote is the evidence.",
      counter: [],
      quotes: [
        {
          speakerName: "Jordan Hale",
          text: "Writes to the primary were linearizable. Replica reads were eventually consistent. The tradeoff was stale reads versus load on the primary.",
          startTime: 278,
        },
      ],
    },
  ];

  for (const item of criteria) {
    let criterion = await prisma.rubricCriterion.findFirst({
      where: { conversationId, title: item.title },
    });
    if (!criterion) {
      criterion = await prisma.rubricCriterion.create({
        data: {
          conversationId,
          title: item.title,
          description: item.description,
          weight: item.weight,
          strongAnchor: STRONG,
          weakAnchor: WEAK,
          sortOrder: item.sortOrder,
        },
      });
    }
    const current = await prisma.scorecardRating.findUnique({ where: { criterionId: criterion.id } });
    if (current?.source === "HUMAN") continue;
    await prisma.scorecardRating.upsert({
      where: { criterionId: criterion.id },
      create: {
        criterionId: criterion.id,
        conversationId,
        organizationId: orgId,
        score: null,
        rationale: item.rationale,
        evidenceKind: item.evidenceKind,
        source: "DRAFT",
        quotes: {
          confidence: item.confidence,
          observation: item.quotes[0]?.text ?? "",
          interpretation: item.rationale,
          support: item.quotes,
          counter: item.counter,
        },
      },
      update: {
        score: null,
        rationale: item.rationale,
        evidenceKind: item.evidenceKind,
        source: "DRAFT",
        quotes: {
          confidence: item.confidence,
          observation: item.quotes[0]?.text ?? "",
          interpretation: item.rationale,
          support: item.quotes,
          counter: item.counter,
        },
      },
    });
  }

  const transcript = await prisma.transcript.findUnique({
    where: { conversationId },
    include: { segments: true },
  });
  const trackers = await prisma.tracker.findMany({
    where: { OR: [{ isBuiltin: true, organizationId: null }, { organizationId: orgId }] },
  });
  await prisma.trackerHit.deleteMany({ where: { conversationId } });
  const hits: Array<{
    trackerId: string;
    startTime: number;
    speakerName: string;
    excerpt: string;
  }> = [];
  for (const segment of transcript?.segments ?? []) {
    const text = segment.text.toLowerCase();
    for (const tracker of trackers) {
      const phrases = Array.isArray(tracker.phrases) ? (tracker.phrases as string[]) : [];
      if (!phrases.some((phrase) => text.includes(phrase.toLowerCase()))) continue;
      hits.push({
        trackerId: tracker.id,
        startTime: segment.startTime,
        speakerName: segment.speakerName,
        excerpt: segment.text,
      });
    }
  }
  if (hits.length > 0) {
    await prisma.trackerHit.createMany({
      data: hits.map((hit) => ({ ...hit, conversationId, organizationId: orgId })),
    });
  }
}

async function attachDemoClaims(prisma: PrismaClient, conversationId: string, orgId: string) {
  await prisma.claim.deleteMany({ where: { conversationId } });

  const segments = await prisma.transcriptSegment.findMany({
    where: { transcript: { conversationId }, isFinal: true },
    orderBy: { startTime: "asc" },
  });
  const participant = await prisma.conversationParticipant.findFirst({
    where: { conversationId, personId: { not: null } },
  });
  const objectives = await prisma.conversationObjective.findMany({ where: { conversationId } });
  const claims = extractClaims(
    segments.map((segment) => ({
      speakerName: segment.speakerName,
      text: segment.text,
      startTime: segment.startTime,
      endTime: segment.endTime,
      isAgent: segment.speakerName === "Kimma",
    })),
    objectives.map((objective) => ({ title: objective.title, text: objective.description })),
  );

  for (const claim of claims) {
    await prisma.claim.create({
      data: {
        organizationId: orgId,
        personId: participant?.personId,
        conversationId,
        topic: claim.topic,
        observation: claim.observation,
        interpretation: claim.interpretation,
        confidence: claim.confidence,
        speakerName: claim.speakerName,
        evidence: {
          create: claim.evidence.map((item) => ({
            organizationId: orgId,
            conversationId,
            role: item.role,
            speakerName: item.speakerName,
            quote: item.quote,
            startTime: item.startTime,
            endTime: item.endTime,
          })),
        },
      },
    });
  }
}
