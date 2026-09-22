import { prisma } from "@aperture/database";
import { requireOrg } from "@/server/org";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { EvidenceBoard } from "@/components/intelligence/evidence-board";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { addRelationshipAction, recordOutcomeAction } from "@/actions/people";
import { formatRelative } from "@/lib/time";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const person = await prisma.person.findUnique({ where: { id }, select: { name: true } });
  return { title: person?.name ?? "Person" };
}

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const org = await requireOrg();
  const { id } = await params;
  const person = await prisma.person.findFirst({
    where: { id, organizationId: org.organizationId },
    include: {
      participants: {
        include: { conversation: { select: { id: true, title: true, createdAt: true, status: true } } },
      },
      claims: {
        include: { evidence: { orderBy: { startTime: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
      relationships: { orderBy: { createdAt: "desc" } },
      outcomes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!person) notFound();

  const topics = [...new Set(person.claims.map((claim) => claim.topic))];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        eyebrow="Person"
        title={person.name}
        description={[person.title, person.email].filter(Boolean).join(" · ") || "No title on file."}
      />

      <section className="mt-10 grid gap-10 lg:grid-cols-[1.4fr_0.6fr]">
        <div>
          <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Evidence</h2>
          <div className="mt-4">
            <EvidenceBoard
              claims={person.claims.map((claim) => ({
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
            />
          </div>
        </div>
        <aside className="space-y-10">
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Topics</h2>
            {topics.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No topics yet.</p>
            ) : (
              <ul className="mt-3 space-y-1 text-sm">
                {topics.map((topic) => (
                  <li key={topic}>{topic}</li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Conversations</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {person.participants.map((participant) => (
                <li key={participant.id}>
                  <Link href={`/conversations/${participant.conversation.id}`} className="hover:underline">
                    {participant.conversation.title}
                  </Link>
                  <div className="text-xs text-muted">{formatRelative(participant.conversation.createdAt)}</div>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Relationships</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {person.relationships.map((relationship) => (
                <li key={relationship.id}>
                  {relationship.kind} · {relationship.otherName}
                  {relationship.note ? <div className="text-xs text-muted">{relationship.note}</div> : null}
                </li>
              ))}
            </ul>
            <form action={addRelationshipAction} className="mt-4 space-y-3">
              <input type="hidden" name="personId" value={person.id} />
              <Field label="Other person">
                <Input name="otherName" placeholder="Name" />
              </Field>
              <Field label="Kind">
                <select name="kind" className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm" defaultValue="COLLEAGUE">
                  <option value="MANAGER">Manager</option>
                  <option value="REPORT">Report</option>
                  <option value="COLLEAGUE">Colleague</option>
                  <option value="CUSTOMER">Customer</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Button type="submit" variant="secondary" size="sm">
                Add relationship
              </Button>
            </form>
          </div>
          <div>
            <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Outcomes</h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              A person records what happened later. Aperture does not predict performance, retention, or who should be hired.
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {person.outcomes.map((outcome) => (
                <li key={outcome.id}>
                  {outcome.decision.replaceAll("_", " ")}
                  <div className="text-xs text-muted">
                    {formatRelative(outcome.createdAt)}
                    {outcome.note ? ` · ${outcome.note}` : ""}
                  </div>
                </li>
              ))}
            </ul>
            <form action={recordOutcomeAction} className="mt-4 space-y-3">
              <input type="hidden" name="personId" value={person.id} />
              <Field label="Recorded decision">
                <select name="decision" className="w-full rounded-md border border-line bg-white px-3 py-2 text-sm" defaultValue="NO_DECISION">
                  <option value="NO_DECISION">No decision</option>
                  <option value="ADVANCED">Advanced</option>
                  <option value="HIRED">Hired</option>
                  <option value="NOT_SELECTED">Not selected</option>
                </select>
              </Field>
              <Field label="Note">
                <Input name="note" placeholder="Optional" />
              </Field>
              <Button type="submit" size="sm">
                Save outcome
              </Button>
            </form>
          </div>
        </aside>
      </section>
    </div>
  );
}
