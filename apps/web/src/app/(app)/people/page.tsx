import { prisma } from "@aperture/database";
import { requireOrg } from "@/server/org";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyState } from "@/components/shell/empty-state";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/badge";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage() {
  const org = await requireOrg();
  const people = await prisma.person.findMany({
    where: { organizationId: org.organizationId },
    include: {
      participants: {
        include: { conversation: { select: { id: true, title: true, status: true } } },
        take: 8,
      },
    },
    orderBy: { name: "asc" },
  });
  const guests = await prisma.conversationParticipant.findMany({
    where: {
      conversation: { organizationId: org.organizationId },
      isAgent: false,
      personId: null,
      role: "PARTICIPANT",
    },
    include: { conversation: { select: { id: true, title: true, status: true } } },
    orderBy: { displayName: "asc" },
    take: 80,
  });

  const guestGroups = new Map<string, typeof guests>();
  for (const guest of guests) {
    const list = guestGroups.get(guest.displayName) ?? [];
    list.push(guest);
    guestGroups.set(guest.displayName, list);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="People"
        description="People accumulate claims across conversations. Aperture records what was said. It does not decide who to hire."
      />
      {people.length === 0 && guestGroups.size === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="No people yet"
            description="Participants appear here when you create conversations."
          />
        </div>
      ) : (
        <div className="mt-10 divide-y divide-line border-y border-line">
          {people.map((person) => (
            <div key={person.id} className="py-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <Link href={`/people/${person.id}`} className="text-sm font-medium hover:underline">
                    {person.name}
                  </Link>
                  <div className="text-xs text-muted">
                    {person.title ? `${person.title} · ` : ""}
                    {person.email ?? "No email"} · {person.participants.length} conversations
                  </div>
                </div>
              </div>
              {person.participants.length > 0 ? (
                <ul className="mt-3 space-y-1.5">
                  {person.participants.map((participant) => (
                    <li key={participant.id} className="flex items-center justify-between gap-3 text-sm">
                      <Link
                        href={`/conversations/${participant.conversation.id}`}
                        className="truncate hover:underline"
                      >
                        {participant.conversation.title}
                      </Link>
                      <StatusBadge status={participant.conversation.status} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
          {[...guestGroups.entries()].map(([name, rows]) => (
            <div key={name} className="py-5">
              <div className="text-sm font-medium">{name}</div>
              <div className="text-xs text-muted">Participant · not yet in the people directory</div>
              <ul className="mt-3 space-y-1.5">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link href={`/conversations/${row.conversation.id}`} className="truncate hover:underline">
                      {row.conversation.title}
                    </Link>
                    <StatusBadge status={row.conversation.status} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
