import { prisma } from "@kimma/database";
import { requireOrg } from "@/server/org";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { formatRelative } from "@/lib/time";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Observability" };

export default async function ObservabilityPage() {
  const org = await requireOrg();
  const [events, jobs] = await Promise.all([
    prisma.conversationEvent.findMany({
      where: { conversation: { organizationId: org.organizationId } },
      orderBy: { timestamp: "desc" },
      take: 80,
      include: { conversation: { select: { id: true, title: true } } },
    }),
    prisma.backgroundJob.findMany({
      where: { organizationId: org.organizationId, status: { in: ["FAILED", "DEAD", "RUNNING"] } },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Observability"
        description="Reconstruct a conversation: turns, interruptions, tools, model latency, cost, and failed jobs."
      />
      {jobs.length > 0 ? (
        <ul className="mt-8 space-y-2 text-sm">
          {jobs.map((job) => (
            <li key={job.id}>
              {job.status} · {job.type}
              {job.lastError ? ` · ${job.lastError}` : ""} · attempt {job.attempts}
            </li>
          ))}
        </ul>
      ) : null}
      {events.length === 0 ? (
        <p className="mt-10 text-sm text-muted">
          Events appear when a conversation runs. Live agent sessions log turns, tools, and latency here.
        </p>
      ) : (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="py-2 pr-4">Time</th>
                <th className="py-2 pr-4">Conversation</th>
                <th className="py-2 pr-4">Event</th>
                <th className="py-2 pr-4">Model</th>
                <th className="py-2 pr-4">Latency</th>
                <th className="py-2">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id} className="border-t border-line">
                  <td className="py-2 pr-4 font-mono text-xs text-muted">
                    {formatRelative(event.timestamp)}
                  </td>
                  <td className="py-2 pr-4">
                    <Link href={`/conversations/${event.conversation.id}`} className="underline">
                      {event.conversation.title}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{event.type}</td>
                  <td className="py-2 pr-4">{event.model ?? "—"}</td>
                  <td className="py-2 pr-4">{event.latencyMs ? `${event.latencyMs}ms` : "—"}</td>
                  <td className="py-2">
                    {event.inputTokens || event.outputTokens
                      ? `${event.inputTokens ?? 0}/${event.outputTokens ?? 0}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
