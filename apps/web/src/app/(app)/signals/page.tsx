import { prisma } from "@kimma/database";
import { requireOrg } from "@/server/org";
import { createTrackerAction } from "@/actions/scorecard";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { formatTimestamp } from "@/lib/time";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Signals" };

export default async function SignalsPage() {
  const org = await requireOrg();
  const canEdit = org.role === "OWNER" || org.role === "ADMIN";
  const trackers = await prisma.tracker.findMany({
    where: { OR: [{ isBuiltin: true, organizationId: null }, { organizationId: org.organizationId }] },
    include: {
      _count: { select: { hits: { where: { organizationId: org.organizationId } } } },
      hits: {
        where: { organizationId: org.organizationId },
        orderBy: { startTime: "desc" },
        take: 3,
        include: { conversation: { select: { id: true, title: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Signals"
        description="Trackers watch for phrases across this organization’s transcripts. A hit is a quote, not a conclusion."
      />
      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {trackers.map((tracker) => {
          const phrases = Array.isArray(tracker.phrases) ? (tracker.phrases as string[]) : [];
          return (
            <article key={tracker.id} className="rounded-xl border border-line bg-white p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-sm font-medium">{tracker.name}</h2>
                <span className="text-xs text-muted">
                  {tracker._count.hits} hits · {tracker.isBuiltin ? "built in" : "custom"}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted">{tracker.description}</p>
              <p className="mt-3 text-xs leading-5 text-muted">{phrases.join(" · ")}</p>
              <ul className="mt-4 space-y-2">
                {tracker.hits.map((hit) => (
                  <li key={hit.id} className="text-sm">
                    <Link href={`/conversations/${hit.conversation.id}`} className="hover:underline">
                      {hit.conversation.title}
                    </Link>
                    <div className="text-xs text-muted">
                      {formatTimestamp(hit.startTime)} · {hit.speakerName}
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
      {canEdit ? (
        <form action={createTrackerAction} className="mt-12 max-w-lg space-y-4">
          <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Add a tracker</h2>
          <Field label="Name">
            <Input name="name" required placeholder="Pricing objection" />
          </Field>
          <Field label="Phrases" hint="Comma-separated. Matched inside this organization only.">
            <Input name="phrases" required placeholder="too expensive, discount, budget" />
          </Field>
          <Button type="submit" size="sm">
            Save tracker
          </Button>
        </form>
      ) : null}
    </div>
  );
}
