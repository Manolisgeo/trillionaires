import { prisma } from "@kimma/database";
import { requireOrg } from "@/server/org";
import { notFound } from "next/navigation";
import { ConversationWorkspace } from "@/components/conversation/workspace";
import { ConversationToolbar } from "@/components/conversation/conversation-toolbar";
import { PageHeader } from "@/components/shell/page-header";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { typeLabel } from "@/lib/time";
import { evidenceFields } from "@/lib/quotes";
import { talkStats } from "@kimma/conversation";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  try {
    const org = await requireOrg();
    const { id } = await params;
    const conversation = await prisma.conversation.findFirst({
      where: { id, organizationId: org.organizationId },
      select: { title: true },
    });
    return { title: conversation ? `${conversation.title} report` : "Report" };
  } catch {
    return { title: "Report" };
  }
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const org = await requireOrg();
  const { id } = await params;
  const conversation = await prisma.conversation.findFirst({
    where: { id, organizationId: org.organizationId },
    include: {
      report: { include: { sections: { orderBy: { sortOrder: "asc" } } } },
      transcript: { include: { segments: { orderBy: { startTime: "asc" } } } },
      insights: true,
      objectives: true,
      participants: true,
      actionItems: true,
      claims: { include: { evidence: { orderBy: { startTime: "asc" } } }, orderBy: { createdAt: "asc" } },
      criteria: { orderBy: { sortOrder: "asc" }, include: { rating: true } },
      trackerHits: { include: { tracker: { select: { name: true } } }, orderBy: { startTime: "asc" } },
    },
  });
  if (!conversation) notFound();

  const reportPayload = conversation.report
    ? {
        summary: conversation.report.executiveSummary,
        sections: conversation.report.sections,
      }
    : null;
  const speaking = talkStats(
    (conversation.transcript?.segments ?? []).map((segment) => ({
      speakerName: segment.speakerName,
      text: segment.text,
      startTime: segment.startTime,
      endTime: segment.endTime,
    })),
  );

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow={`${typeLabel(conversation.type)} report`}
        title={conversation.title}
        description="Structured evidence. Facts, inferences, and uncertainties are labeled."
        actions={
          <>
            <Link href={`/conversations/${conversation.id}`} className="print:hidden">
              <Button variant="secondary">Conversation</Button>
            </Link>
            <ConversationToolbar
              conversationId={conversation.id}
              title={conversation.title}
              canDelete={false}
              transcript={(conversation.transcript?.segments ?? []).map((s) => ({
                speakerName: s.speakerName,
                startTime: s.startTime,
                text: s.text,
              }))}
              report={reportPayload}
            />
          </>
        }
      />
      <ConversationWorkspace
        initialTab="report"
        purpose={conversation.purpose}
        objectives={conversation.objectives.map((o) => ({
          id: o.id,
          title: o.title,
          status: o.status,
        }))}
        participants={conversation.participants.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          role: p.role,
          isAgent: p.isAgent,
        }))}
        segments={(conversation.transcript?.segments ?? []).map((s) => ({
          id: s.id,
          speakerName: s.speakerName,
          text: s.text,
          startTime: s.startTime,
          isFinal: s.isFinal,
          category: s.category,
        }))}
        insights={conversation.insights.map((insight) => ({
          id: insight.id,
          title: insight.title,
          body: insight.body,
          kind: insight.kind,
          category: insight.category,
          timestampSeconds: insight.timestampSeconds,
        }))}
        actionItems={conversation.actionItems.map((item) => ({
          id: item.id,
          text: item.text,
          owner: item.owner,
          completed: item.completed,
        }))}
        report={reportPayload}
        claims={conversation.claims.map((claim) => ({
          id: claim.id,
          topic: claim.topic,
          observation: claim.observation,
          interpretation: claim.interpretation,
          confidence: claim.confidence,
          speakerName: claim.speakerName,
          evidence: claim.evidence.map((item) => ({
            id: item.id,
            role: item.role,
            speakerName: item.speakerName,
            quote: item.quote,
            startTime: item.startTime,
          })),
        }))}
        scorecard={{
          conversationId: conversation.id,
          criteria: conversation.criteria.map((criterion) => ({
            id: criterion.id,
            title: criterion.title,
            description: criterion.description,
            weight: criterion.weight,
            strongAnchor: criterion.strongAnchor,
            weakAnchor: criterion.weakAnchor,
            rating: criterion.rating
              ? {
                  score: criterion.rating.score,
                  rationale: criterion.rating.rationale,
                  evidenceKind: criterion.rating.evidenceKind,
                  source: criterion.rating.source,
                  ...evidenceFields(criterion.rating.quotes, criterion.rating.rationale),
                }
              : null,
          })),
          speakers: speaking.speakers,
          questions: speaking.questions,
          hits: conversation.trackerHits.map((hit) => ({
            id: hit.id,
            trackerName: hit.tracker.name,
            startTime: hit.startTime,
            speakerName: hit.speakerName,
            excerpt: hit.excerpt,
          })),
        }}
      />
    </div>
  );
}
