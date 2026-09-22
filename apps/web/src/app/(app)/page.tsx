import { prisma } from "@aperture/database";
import { requireOrg } from "@/server/org";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import { ActionToggle } from "@/components/dashboard/action-toggle";
import { formatRelative, typeLabel } from "@/lib/time";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const org = await requireOrg();
  const [conversations, actionItems, totals, insights, memberCount] = await Promise.all([
    prisma.conversation.findMany({
      where: { organizationId: org.organizationId },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.actionItem.findMany({
      where: { organizationId: org.organizationId, completed: false },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { conversation: { select: { id: true, title: true } } },
    }),
    prisma.conversation.groupBy({
      by: ["status"],
      where: { organizationId: org.organizationId },
      _count: true,
    }),
    prisma.conversationInsight.findMany({
      where: { conversation: { organizationId: org.organizationId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { conversation: { select: { id: true, title: true } } },
    }),
    prisma.organizationMember.count({ where: { organizationId: org.organizationId } }),
  ]);

  const count = (status: string) => totals.find((row) => row.status === status)?._count ?? 0;
  const total = totals.reduce((sum, row) => sum + row._count, 0);
  const reportsReady = count("COMPLETED");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Dashboard"
        description="Recent conversations, open actions, and evidence — not a feed of summaries."
        actions={
          <Link href="/conversations/new">
            <Button>New conversation</Button>
          </Link>
        }
      />

      <div className="mt-10 grid gap-3 sm:grid-cols-4">
        <Stat label="Conversations" value={String(total)} />
        <Stat label="Reports ready" value={String(reportsReady)} />
        <Stat label="Live" value={String(count("LIVE"))} />
        <Stat label="Open actions" value={String(actionItems.length)} />
      </div>

      {total === 0 ? (
        <div className="mt-12 rounded-xl border border-line bg-white p-6">
          <h2 className="text-sm font-medium">Start this workspace</h2>
          <ol className="mt-4 space-y-3 text-sm leading-6 text-muted">
            <li>1. Create a conversation with a purpose and objectives.</li>
            <li>2. Disclose recording and collect consent.</li>
            <li>3. Speak with the AI participant — it follows the conversation, not a script.</li>
            <li>4. Open the structured report. Facts, inferences, and uncertainties are labeled.</li>
          </ol>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/conversations/new">
              <Button size="sm">New conversation</Button>
            </Link>
            <Link href="/templates">
              <Button size="sm" variant="secondary">
                Browse templates
              </Button>
            </Link>
            {memberCount < 2 ? (
              <Link href="/settings">
                <Button size="sm" variant="ghost">
                  Invite the team
                </Button>
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="mt-12">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Recent</h2>
          <Link href="/conversations" className="text-xs text-muted hover:text-ink">
            View all
          </Link>
        </div>
        {conversations.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              title="No conversations yet"
              description="Create a conversation, set the objective, and let the AI participant work from that state — not a script."
              action={
                <Link href="/conversations/new">
                  <Button>Start one</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-4 divide-y divide-line border-y border-line">
            {conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/conversations/${conversation.id}`}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{conversation.title}</div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {typeLabel(conversation.type)} · {formatRelative(conversation.createdAt)}
                  </div>
                </div>
                <StatusBadge status={conversation.status} />
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="mt-12 grid gap-12 lg:grid-cols-2">
        <section>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Action items
          </h2>
          {actionItems.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Nothing open. Actions are extracted after a call.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {actionItems.map((item) => (
                <li key={item.id} className="flex items-start gap-3 text-sm">
                  <ActionToggle id={item.id} completed={item.completed} />
                  <div>
                    <Link href={`/conversations/${item.conversation.id}`} className="hover:underline">
                      {item.text}
                    </Link>
                    <div className="text-xs text-muted">
                      {item.owner ? `${item.owner} · ` : ""}
                      {item.conversation.title}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
            Important insights
          </h2>
          {insights.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              Insights appear after analysis, labeled as fact, inference, or uncertainty.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {insights.map((insight) => (
                <li key={insight.id} className="text-sm">
                  <span className="text-[11px] uppercase tracking-wide text-muted">{insight.kind}</span>
                  <div>
                    <Link href={`/conversations/${insight.conversation.id}`} className="hover:underline">
                      {insight.title}
                    </Link>
                  </div>
                  <div className="text-xs text-muted">{insight.conversation.title}</div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-white px-5 py-4">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-2 text-2xl font-medium tabular-nums">{value}</div>
    </div>
  );
}
