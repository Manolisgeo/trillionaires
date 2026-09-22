import { hash } from "bcryptjs";
import { prisma } from "./index";
import { seedDemoConversation } from "./demo-conversation";

const builtinTrackers: Array<{ name: string; description: string; phrases: string[] }> = [
  {
    name: "Metrics",
    description: "Numbers, latency, throughput, and other measurable claims.",
    phrases: ["percent", "latency", "requests", "qps", "p99", "million", "seconds"],
  },
  {
    name: "Incidents",
    description: "Production failures, postmortems, and recovery.",
    phrases: ["incident", "postmortem", "outage", "failure", "lag", "stale"],
  },
  {
    name: "Commitments",
    description: "A promise to send something or follow up.",
    phrases: ["i'll send", "i will send", "follow up", "i'll follow"],
  },
  {
    name: "Compensation",
    description: "Pay, equity, or an offer mentioned in the conversation.",
    phrases: ["salary", "compensation", "equity", "offer", "comp"],
  },
  {
    name: "Competing option",
    description: "Another vendor, offer, or path.",
    phrases: ["other offer", "competitor", "alternative", "evaluating"],
  },
  {
    name: "Decision process",
    description: "Who decides, and what has to happen next.",
    phrases: ["decision", "stakeholder", "approve", "budget", "timeline"],
  },
];

async function main() {
  const passwordHash = await hash("aperture-dev", 12);

  const user = await prisma.user.upsert({
    where: { email: "founder@aperture.local" },
    update: {},
    create: {
      email: "founder@aperture.local",
      name: "Founder",
      passwordHash,
    },
  });

  const org = await prisma.organization.upsert({
    where: { slug: "aperture" },
    update: {},
    create: {
      name: "Aperture",
      slug: "aperture",
      retentionDays: 365,
      requireConsent: true,
    },
  });

  await prisma.organizationMember.upsert({
    where: {
      organizationId_userId: { organizationId: org.id, userId: user.id },
    },
    update: { role: "OWNER" },
    create: {
      organizationId: org.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  const builtins: Array<{
    type: "INTERVIEW" | "SALES" | "RESEARCH" | "EXPERT_INTERVIEW" | "MEETING";
    name: string;
    description: string;
    config: Record<string, unknown>;
  }> = [
    {
      type: "INTERVIEW",
      name: "Engineering interview",
      description: "Evaluate engineering ability against role competencies.",
      config: {
        role: "Software engineer",
        competencies: ["system design", "ownership", "collaboration"],
        difficulty: "mid",
        objectives: [
          "Assess backend engineering ability",
          "Understand how they handle production incidents",
          "Evaluate communication under ambiguity",
        ],
      },
    },
    {
      type: "SALES",
      name: "Discovery call",
      description: "Uncover pain, process, and buying signals.",
      config: {
        discoveryObjectives: ["pain", "current process", "decision process"],
        painPoints: [],
        objections: [],
        buyingSignals: ["timeline", "budget owner", "urgency"],
      },
    },
    {
      type: "RESEARCH",
      name: "Customer interview",
      description: "Test hypotheses and capture customer language.",
      config: {
        researchQuestions: ["What problem are they solving today?"],
        hypotheses: [],
        topics: ["onboarding", "pricing", "workflow"],
      },
    },
    {
      type: "EXPERT_INTERVIEW",
      name: "Expert interview",
      description: "Investigate claims and map expertise.",
      config: {
        areasOfExpertise: [],
        claimsToInvestigate: [],
        topics: [],
      },
    },
    {
      type: "MEETING",
      name: "Working meeting",
      description: "Capture decisions, owners, and follow-ups.",
      config: {
        objectives: ["Decisions", "Owners", "Risks"],
      },
    },
  ];

  for (const template of builtins) {
    const existing = await prisma.conversationTemplate.findFirst({
      where: { isBuiltin: true, name: template.name, organizationId: null },
    });
    if (!existing) {
      await prisma.conversationTemplate.create({
        data: {
          type: template.type,
          name: template.name,
          description: template.description,
          isBuiltin: true,
          config: template.config as object,
        },
      });
    }
  }

  for (const tracker of builtinTrackers) {
    const existing = await prisma.tracker.findFirst({
      where: { isBuiltin: true, organizationId: null, name: tracker.name },
    });
    if (!existing) {
      await prisma.tracker.create({
        data: {
          name: tracker.name,
          description: tracker.description,
          phrases: tracker.phrases,
          isBuiltin: true,
        },
      });
    }
  }

  console.log("Seeded founder@aperture.local / aperture-dev");
  await seedDemoConversation(prisma, org.id, user.id);
  console.log("Seeded demo conversation: Staff backend screen · Jordan Hale");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
