import {
  ANALYSIS_SYSTEM_PROMPT,
  analysisUserPrompt,
  createOpenAiClient,
  emptyReport,
  estimateChatCostUsd,
  OpenAiAnalysisProvider,
  OpenAiEmbeddingProvider,
} from "@aperture/ai";
import { prisma } from "@aperture/database";
import type { StructuredReport } from "@aperture/types";
import { cosineSimilarity } from "@/server/search-math";
import { refreshScorecard, refreshTrackerHits } from "@/server/evidence";
import { persistClaims } from "@/server/claims";

export async function runAnalysisPipeline(conversationId: string): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      objectives: true,
      transcript: { include: { segments: { orderBy: { startTime: "asc" } } } },
      events: { orderBy: { timestamp: "asc" }, take: 200 },
    },
  });
  if (!conversation) return;
  if (conversation.analysisStatus === "COMPLETED") return;

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { analysisStatus: "RUNNING", reportStatus: "RUNNING" },
  });

  await prisma.conversationEvent.create({
    data: {
      conversationId,
      type: "ANALYSIS_STARTED",
      data: {},
    },
  });

  const segments = conversation.transcript?.segments.filter((s) => s.isFinal) ?? [];
  let report: StructuredReport = emptyReport();
  let model = process.env.OPENAI_ANALYSIS_MODEL ?? "gpt-4.1";
  let usage = { input: 0, output: 0, latencyMs: 0 };

  if (process.env.OPENAI_API_KEY && segments.length > 0) {
    const provider = new OpenAiAnalysisProvider(
      createOpenAiClient(process.env.OPENAI_API_KEY),
      model,
    );
    const result = await provider.complete({
      messages: [
        { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
        {
          role: "user",
          content: analysisUserPrompt({
            type: conversation.type,
            title: conversation.title,
            purpose: conversation.purpose,
            objectives: conversation.objectives.map((o) => ({
              title: o.title,
              description: o.description,
            })),
            transcript: segments.map((s) => ({
              speakerName: s.speakerName,
              text: s.text,
              startTime: s.startTime,
            })),
            events: conversation.events.map((e) => ({ type: e.type, data: e.data })),
          }),
        },
      ],
      jsonSchema: { type: "object" },
    });
    usage = {
      input: result.inputTokens,
      output: result.outputTokens,
      latencyMs: result.latencyMs,
    };
    model = result.model;
    try {
      report = { ...emptyReport(), ...(JSON.parse(result.text) as StructuredReport) };
    } catch {
      report = {
        ...emptyReport(),
        executiveSummary: result.text.slice(0, 1200),
        detailedAnalysis: result.text,
      };
    }
  } else if (segments.length > 0) {
    report = heuristicReport(conversation.purpose, segments);
  }

  const dbReport = await prisma.report.upsert({
    where: { conversationId },
    create: {
      conversationId,
      status: "COMPLETED",
      executiveSummary: report.executiveSummary,
    },
    update: {
      status: "COMPLETED",
      executiveSummary: report.executiveSummary,
    },
  });

  await prisma.reportSection.deleteMany({ where: { reportId: dbReport.id } });

  const sections: Array<{ key: string; title: string; body: string; order: number }> = [
    { key: "executive_summary", title: "Executive Summary", body: report.executiveSummary, order: 0 },
    {
      key: "key_takeaways",
      title: "Key Takeaways",
      body: report.keyTakeaways.map((item) => `- ${item}`).join("\n"),
      order: 1,
    },
    {
      key: "important_moments",
      title: "Important Moments",
      body: report.importantMoments
        .map((m) => `- [${formatTs(m.timestampSeconds)}] ${m.label}: ${m.summary}`)
        .join("\n"),
      order: 2,
    },
    {
      key: "decisions",
      title: "Decisions",
      body: report.decisions.map((item) => `- ${item}`).join("\n"),
      order: 3,
    },
    {
      key: "action_items",
      title: "Action Items",
      body: report.actionItems
        .map((item) => `- ${item.text}${item.owner ? ` (${item.owner})` : ""}`)
        .join("\n"),
      order: 4,
    },
    {
      key: "questions_raised",
      title: "Questions Raised",
      body: report.questionsRaised.map((item) => `- ${item}`).join("\n"),
      order: 5,
    },
    {
      key: "contradictions",
      title: "Contradictions / Inconsistencies",
      body: report.contradictions
        .map(
          (item) =>
            `- ${item.summary}: “${item.statementA}” vs “${item.statementB}” [${formatTs(item.timestampSeconds)}]`,
        )
        .join("\n"),
      order: 6,
    },
    {
      key: "evidence",
      title: "Evidence",
      body: report.evidence
        .map((item) => `- [${item.kind}] ${item.claim}\n  Excerpt: “${item.excerpt}”`)
        .join("\n"),
      order: 7,
    },
    {
      key: "topics",
      title: "Topics Discussed",
      body: report.topics
        .map((item) => `- ${item.title} (importance ${item.importance}): ${item.summary}`)
        .join("\n"),
      order: 8,
    },
    { key: "detailed_analysis", title: "Detailed Analysis", body: report.detailedAnalysis, order: 9 },
  ];

  await prisma.reportSection.createMany({
    data: sections.map((section) => ({
      reportId: dbReport.id,
      key: section.key,
      title: section.title,
      body: section.body || "None identified in the transcript.",
      sortOrder: section.order,
    })),
  });

  await prisma.actionItem.deleteMany({ where: { conversationId } });
  if (report.actionItems.length > 0) {
    await prisma.actionItem.createMany({
      data: report.actionItems.map((item) => ({
        conversationId,
        organizationId: conversation.organizationId,
        text: item.text,
        owner: item.owner,
        timestampSeconds: item.sourceTimestampSeconds,
      })),
    });
  }

  await prisma.conversationInsight.deleteMany({ where: { conversationId } });
  const insights = [
    ...report.evidence.map((item) => ({
      kind: item.kind,
      category: "KEY_FACT" as const,
      title: item.claim,
      body: item.excerpt,
      timestampSeconds: item.timestampSeconds,
    })),
    ...report.contradictions.map((item) => ({
      kind: "UNCERTAINTY" as const,
      category: "CONTRADICTION" as const,
      title: item.summary,
      body: `${item.statementA} / ${item.statementB}`,
      timestampSeconds: item.timestampSeconds,
    })),
    ...report.importantMoments.map((item) => ({
      kind: "INFERENCE" as const,
      category: item.category,
      title: item.label,
      body: item.summary,
      timestampSeconds: item.timestampSeconds,
    })),
  ];
  if (insights.length > 0) {
    await prisma.conversationInsight.createMany({
      data: insights.map((insight) => ({
        conversationId,
        ...insight,
      })),
    });
  }

  for (const evaluation of report.objectiveEvaluations) {
    const match = conversation.objectives.find((o) => o.title === evaluation.title);
    if (match) {
      await prisma.conversationObjective.update({
        where: { id: match.id },
        data: { status: evaluation.status === "COVERED" ? "COVERED" : evaluation.status },
      });
    }
  }

  await indexConversationSearch(conversationId, conversation.organizationId, report, segments);
  await refreshScorecard(conversationId);
  await refreshTrackerHits(conversationId);
  await persistClaims(conversationId);

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      analysisStatus: "COMPLETED",
      reportStatus: "COMPLETED",
      transcriptStatus: "COMPLETED",
      status: "COMPLETED",
    },
  });

  await prisma.conversationEvent.create({
    data: {
      conversationId,
      type: "ANALYSIS_COMPLETED",
      data: { model },
      model,
      latencyMs: usage.latencyMs,
      inputTokens: usage.input,
      outputTokens: usage.output,
      estimatedCostUsd: estimateChatCostUsd(usage.input, usage.output),
    },
  });
}

async function indexConversationSearch(
  conversationId: string,
  organizationId: string,
  report: StructuredReport,
  segments: Array<{ text: string; speakerName: string }>,
) {
  const content = [
    report.executiveSummary,
    report.keyTakeaways.join("\n"),
    report.detailedAnalysis,
    segments.map((s) => `${s.speakerName}: ${s.text}`).join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 12000);

  let embedding: number[] | null = null;
  if (process.env.OPENAI_API_KEY && content.trim()) {
    try {
      const embeddings = new OpenAiEmbeddingProvider(
        createOpenAiClient(process.env.OPENAI_API_KEY),
        process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      );
      embedding = (await embeddings.embed([content]))[0] ?? null;
    } catch (error) {
      console.warn("Embedding failed; keyword search still available.", error);
    }
  }

  await prisma.searchDocument.deleteMany({ where: { conversationId } });
  await prisma.searchDocument.create({
    data: {
      organizationId,
      conversationId,
      chunkType: "CONVERSATION_SUMMARY",
      content,
      embedding: embedding ?? undefined,
      metadata: { title: report.executiveSummary.slice(0, 180) },
    },
  });
}

export async function searchConversations(input: {
  organizationId: string;
  query: string;
}): Promise<Array<{ conversationId: string; score: number; snippet: string }>> {
  const docs = await prisma.searchDocument.findMany({
    where: { organizationId: input.organizationId },
    include: { conversation: { select: { title: true, type: true } } },
  });

  const q = input.query.trim().toLowerCase();
  if (!q) return [];

  let queryEmbedding: number[] | null = null;
  if (process.env.OPENAI_API_KEY) {
    try {
      const embeddings = new OpenAiEmbeddingProvider(
        createOpenAiClient(process.env.OPENAI_API_KEY),
        process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
      );
      queryEmbedding = (await embeddings.embed([input.query]))[0] ?? null;
    } catch {
      queryEmbedding = null;
    }
  }

  return docs
    .map((doc) => {
      const keyword = doc.content.toLowerCase().includes(q) ? 0.35 : 0;
      const stored = Array.isArray(doc.embedding) ? (doc.embedding as number[]) : null;
      const semantic =
        queryEmbedding && stored ? Math.max(0, cosineSimilarity(queryEmbedding, stored)) : 0;
      return {
        conversationId: doc.conversationId,
        score: semantic + keyword,
        snippet: doc.content.slice(0, 280),
        title: doc.conversation.title,
      };
    })
    .filter((item) => item.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

function heuristicReport(
  purpose: string,
  segments: Array<{ speakerName: string; text: string; startTime: number }>,
): StructuredReport {
  const joined = segments.map((s) => s.text).join(" ");
  return {
    executiveSummary: `This conversation was conducted for: ${purpose}. ${segments.length} transcript segments were captured. A high-reasoning model was not configured, so this is a transcript-grounded placeholder — not a substitute for model analysis.`,
    keyTakeaways: segments.slice(0, 5).map((s) => s.text.slice(0, 180)),
    importantMoments: segments
      .filter((s) => s.text.length > 80)
      .slice(0, 6)
      .map((s) => ({
        label: s.text.slice(0, 48),
        timestampSeconds: s.startTime,
        summary: s.text.slice(0, 200),
        category: "INSIGHT" as const,
      })),
    decisions: [],
    actionItems: [],
    questionsRaised: segments.filter((s) => s.text.includes("?")).map((s) => s.text),
    contradictions: [],
    evidence: segments.slice(0, 8).map((s) => ({
      claim: s.text.slice(0, 140),
      kind: "FACT" as const,
      excerpt: s.text,
      timestampSeconds: s.startTime,
    })),
    topics: [{ title: "Discussion", importance: 0.5, summary: joined.slice(0, 280) }],
    detailedAnalysis: joined.slice(0, 2000),
    objectiveEvaluations: [],
  };
}

function formatTs(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
