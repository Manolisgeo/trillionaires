import { prisma } from "@aperture/database";
import { requireOrg } from "@/server/org";
import { runRetentionAction, updateOrganizationAction } from "@/actions/settings";
import { removeMemberAction, revokeInviteAction } from "@/actions/team";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PageHeader } from "@/components/shell/page-header";
import { InviteForm } from "@/components/settings/invite-form";
import Link from "next/link";
import { formatRelative } from "@/lib/time";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const org = await requireOrg();
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: org.organizationId },
  });
  const canEdit = org.role === "OWNER" || org.role === "ADMIN";
  const cutoff = new Date(Date.now() - organization.retentionDays * 24 * 60 * 60 * 1000);

  const [members, invites, audit, retentionDue] = await Promise.all([
    prisma.organizationMember.findMany({
      where: { organizationId: org.organizationId },
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.organizationInvite.findMany({
      where: { organizationId: org.organizationId, acceptedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { organizationId: org.organizationId },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { user: { select: { name: true, email: true } } },
    }),
    prisma.conversation.findMany({
      where: {
        organizationId: org.organizationId,
        OR: [{ endedAt: { lt: cutoff } }, { endedAt: null, createdAt: { lt: cutoff } }],
      },
      select: { id: true, title: true, endedAt: true, createdAt: true },
      orderBy: { createdAt: "asc" },
      take: 20,
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Settings"
        description="Organization data controls. Conversation recordings are sensitive."
      />

      <section className="mt-10">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Organization</h2>
        <form action={updateOrganizationAction} className="mt-4 space-y-5">
          <Field label="Organization name">
            <Input name="name" defaultValue={organization.name} required disabled={!canEdit} />
          </Field>
          <Field
            label="Retention (days)"
            hint="Conversations older than this appear below for review. Deletion is explicit — nothing is silently erased."
          >
            <Input
              name="retentionDays"
              type="number"
              min={7}
              max={3650}
              defaultValue={organization.retentionDays}
              disabled={!canEdit}
            />
          </Field>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="requireConsent"
              defaultChecked={organization.requireConsent}
              disabled={!canEdit}
              className="mt-1"
            />
            <span>
              Require explicit consent before a recorded conversation can start.
              <span className="mt-1 block text-xs text-muted">
                Recommended. There is no hidden recording mode.
              </span>
            </span>
          </label>
          <div className="text-sm">
            <span className="text-xs uppercase tracking-wide text-muted">Your role</span>
            <div className="mt-1">{org.role}</div>
          </div>
          {canEdit ? (
            <Button type="submit">Save</Button>
          ) : (
            <p className="text-sm text-muted">Only owners and admins can change these controls.</p>
          )}
        </form>
      </section>

      <section className="mt-14">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Team</h2>
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <div>
                <div className="font-medium">{member.user.name ?? member.user.email}</div>
                <div className="text-xs text-muted">
                  {member.user.email} · {member.role.toLowerCase()}
                </div>
              </div>
              {canEdit && member.userId !== org.userId && member.role !== "OWNER" ? (
                <form action={removeMemberAction.bind(null, member.id)}>
                  <Button type="submit" variant="ghost" size="sm">
                    Remove
                  </Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        {invites.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {invites.map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-3 text-muted">
                <span>
                  {invite.email} · pending {invite.role.toLowerCase()} · expires{" "}
                  {formatRelative(invite.expiresAt)}
                </span>
                {canEdit ? (
                  <form action={revokeInviteAction.bind(null, invite.id)}>
                    <Button type="submit" variant="ghost" size="sm">
                      Revoke
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {canEdit ? <InviteForm /> : null}
      </section>

      <section className="mt-14">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Retention review
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-muted">
          Conversations older than {organization.retentionDays} days have their transcript, search text, and
          recording removed. The title and extracted claims stay until someone deletes the conversation.
        </p>
        {canEdit ? (
          <form action={runRetentionAction} className="mt-4">
            <Button type="submit" variant="secondary">
              Run retention now
            </Button>
          </form>
        ) : null}
        {retentionDue.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Nothing is waiting on that window.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {retentionDue.map((conversation) => (
              <li key={conversation.id} className="flex items-center justify-between gap-3 text-sm">
                <Link href={`/conversations/${conversation.id}`} className="hover:underline">
                  {conversation.title}
                </Link>
                <span className="text-xs text-muted">
                  {formatRelative(conversation.endedAt ?? conversation.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-14">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Audit log</h2>
        {audit.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No audited actions yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {audit.map((entry) => (
              <li key={entry.id} className="py-3 text-sm">
                <div>{entry.action}</div>
                <div className="text-xs text-muted">
                  {entry.user?.email ?? "system"} · {formatRelative(entry.createdAt)}
                  {entry.resourceType ? ` · ${entry.resourceType}` : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-10 text-sm leading-6 text-muted">
        Recordings are stored in object storage with signed URLs. Provider API keys never ship to
        the browser. Deleting a conversation removes its transcript, report, and metadata for this
        organization.
      </p>
      <Link href="/observability" className="mt-6 inline-block text-sm underline">
        Observability
      </Link>
    </div>
  );
}
