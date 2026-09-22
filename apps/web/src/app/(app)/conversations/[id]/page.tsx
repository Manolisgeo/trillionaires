import { prisma } from "@aperture/database";
import { requireOrg } from "@/server/org";
import { notFound } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProcessingPoller } from "@/components/conversation/processing-poller";
import { ConsentButton } from "@/components/conversation/consent-button";
import { ConversationWorkspace } from "@/components/conversation/workspace";
import { ConversationToolbar } from "@/components/conversation/conversation-toolbar";
import { PageHeader } from "@/components/shell/page-header";
import { typeLabel } from "@/lib/time";
import { evidenceFields } from "@/lib/quotes";
import { talkStats } from "@aperture/conversation";
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
    return { title: conversation?.title ?? "Conversation" };
  } catch {
    return { title: "Conversation" };
  }
}

export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const org = await requireOrg();
  const { id } = await params;
  const conversation = await prisma.conversation.findFirst({
    where: { id, organizationId: org.organizationId },
    include: {
      participants: true,
      objectives: { orderBy: { sortOrder: "asc" } },
      transcript: { include: { segments: { orderBy: { startTime: "asc" } } } },
      insights: { orderBy: { timestampSeconds: "asc" } },
      report: { include: { sections: { orderBy: { sortOrder: "asc" } } } },
      actionItems: { orderBy: { createdAt: "asc" } },
      claims: { include: { evidence: { orderBy: { startTime: "asc" } } }, orderBy: { createdAt: "asc" } },
      criteria: { orderBy: { sortOrder: "asc" }, include: { rating: true } },
      trackerHits: { include: { tracker: { select: { name: true } } }, orderBy: { startTime: "asc" } },
    },
  });
  if (!conversation) notFound();

  const pendingConsent = conversation.participants.some(
    (p) => !p.isAgent && p.consentStatus !== "GRANTED",
  );
  const canStart =
    conversation.status !== "COMPLETED" &&
    conversation.status !== "FAILED" &&
    conversation.status !== "CANCELLED" &&
    !pendingConsent;

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
      <ProcessingPoller
        conversationId={conversation.id}
        active={conversation.status === "PROCESSING" || conversation.analysisStatus === "RUNNING"}
      />
      <PageHeader
        eyebrow={typeLabel(conversation.type)}
        title={conversation.title}
        description={conversation.purpose}
        actions={
          <>
            {canStart ? (
              <Link href={`/conversations/${conversation.id}/room`}>
                <Button>{conversation.status === "LIVE" ? "Rejoin" : "Start call"}</Button>
              </Link>
            ) : null}
            {conversation.report ? (
              <Link href={`/conversations/${conversation.id}/report`}>
                <Button variant="secondary">Full report</Button>
              </Link>
            ) : null}
          </>
        }
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={conversation.status} />
          <StatusBadge status={conversation.analysisStatus} />
        </div>
        <ConversationToolbar
          conversationId={conversation.id}
          title={conversation.title}
          canDelete={org.role === "OWNER" || org.role === "ADMIN"}
          transcript={(conversation.transcript?.segments ?? []).map((s) => ({
            speakerName: s.speakerName,
            startTime: s.startTime,
            text: s.text,
          }))}
          report={reportPayload}
        />
      </div>

      {pendingConsent ? (
        <div className="mt-8 rounded-xl border border-line bg-white p-5">
          <h2 className="text-sm font-medium">Recording and AI disclosure</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            This conversation will be recorded. An AI participant named Aperture will join, listen,
            and speak. It is not a human. Consent is required before the room can start.
          </p>
          <div className="mt-4">
            <ConsentButton conversationId={conversation.id} />
          </div>
        </div>
      ) : null}

      {conversation.status === "PROCESSING" ? (
        <p className="mt-8 text-sm text-muted">
          Processing transcript and analysis. This page refreshes when the report is ready.
        </p>
      ) : null}

      <ConversationWorkspace
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
          importanceScore: s.importanceScore,
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
