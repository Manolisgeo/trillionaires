"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { inviteMemberAction } from "@/actions/team";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteMemberAction, undefined);
  const [inviteUrl, setInviteUrl] = useState<string>();

  useEffect(() => {
    if (!state?.invitePath) return;
    const url = `${window.location.origin}${state.invitePath}`;
    setInviteUrl(url);
    void navigator.clipboard.writeText(url).then(() => {
      toast.success("Invite link copied.");
    });
  }, [state?.invitePath]);

  return (
    <form action={action} className="mt-4 space-y-3">
      <Field label="Email">
        <Input name="email" type="email" required placeholder="alex@company.com" />
      </Field>
      <Field label="Role">
        <select
          name="role"
          defaultValue="MEMBER"
          className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-ink"
        >
          <option value="MEMBER">Member</option>
          <option value="ADMIN">Admin</option>
        </select>
      </Field>
      {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
      {inviteUrl ? (
        <p className="break-all text-xs leading-5 text-muted">{inviteUrl}</p>
      ) : (
        <p className="text-xs text-muted">No email is sent. Copy the invite link and share it yourself.</p>
      )}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Creating…" : "Create invite link"}
      </Button>
    </form>
  );
}
