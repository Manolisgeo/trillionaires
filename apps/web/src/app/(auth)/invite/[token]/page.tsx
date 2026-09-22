import { prisma } from "@aperture/database";
import { AcceptInviteForm } from "./accept-form";
import { AuthFrame } from "@/components/auth/auth-frame";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Join workspace" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await prisma.organizationInvite.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } },
  });

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return (
      <AuthFrame
        quote="That invite is no longer valid."
        detail="Ask an owner or admin to send a new link. Invites expire after 14 days and cannot be reused."
        footer="Organization isolation is unchanged."
      >
        <h1 className="text-3xl font-medium tracking-tight">Invite expired</h1>
        <p className="mt-2 text-sm text-muted">Request a fresh link from your workspace admin.</p>
        <p className="mt-8 text-sm">
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </p>
      </AuthFrame>
    );
  }

  return (
    <AcceptInviteForm
      token={invite.token}
      email={invite.email}
      organizationName={invite.organization.name}
    />
  );
}
