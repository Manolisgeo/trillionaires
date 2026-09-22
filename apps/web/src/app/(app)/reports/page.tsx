import { prisma } from "@aperture/database";
import { requireOrg } from "@/server/org";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { Button } from "@/components/ui/button";
import { formatRelative, typeLabel } from "@/lib/time";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const org = await requireOrg();
  const reports = await prisma.report.findMany({
    where: { conversation: { organizationId: org.organizationId } },
    include: {
      conversation: { select: { id: true, title: true, type: true, createdAt: true } },
      _count: { select: { sections: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Reports"
        description="Structured evidence, not generic summaries. Inferences are never presented as facts."
      />
      {reports.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No reports yet"
            description="End a conversation and analysis will produce an executive summary, moments, contradictions, and a labeled evidence section."
            action={
              <Link href="/conversations/new">
                <Button>New conversation</Button>
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-10 divide-y divide-line border-y border-line">
          {reports.map((report) => (
            <Link
              key={report.id}
              href={`/conversations/${report.conversation.id}/report`}
              className="block py-4"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-[11px] uppercase tracking-wide text-muted">
                  {typeLabel(report.conversation.type)}
                </div>
                <div className="text-xs text-muted">{formatRelative(report.updatedAt)}</div>
              </div>
              <div className="mt-1 text-sm font-medium">{report.conversation.title}</div>
              <div className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
                {report.executiveSummary ?? "No summary yet."}
              </div>
              <div className="mt-2 text-[11px] text-muted">
                {report._count.sections} sections · labeled evidence
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
