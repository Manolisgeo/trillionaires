"use client";

import { useActionState } from "react";
import { acceptInviteAction } from "@/actions/team";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function AcceptInviteForm({
  token,
  email,
  organizationName,
}: {
  token: string;
  email: string;
  organizationName: string;
}) {
  const [state, action, pending] = useActionState(acceptInviteAction, undefined);

  return (
    <AuthFrame
      quote="You were invited into an isolated workspace."
      detail="Conversations, transcripts, and reports in this organization stay here. The AI participant is always disclosed."
      footer="Accepting does not grant access to any other tenant."
    >
      <p className="text-sm font-medium tracking-tight lg:hidden">Kimma</p>
      <h1 className="text-3xl font-medium tracking-tight">Join {organizationName}</h1>
      <p className="mt-2 text-sm text-muted">
        Invited as <span className="text-ink">{email}</span>
      </p>
      <form action={action} className="mt-8 space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label="Name">
          <Input name="name" required autoComplete="name" />
        </Field>
        <Field label="Password" hint="At least 8 characters. Existing accounts: use your current password.">
          <Input name="password" type="password" minLength={8} required autoComplete="new-password" />
        </Field>
        {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Joining…" : "Join workspace"}
        </Button>
      </form>
    </AuthFrame>
  );
}
