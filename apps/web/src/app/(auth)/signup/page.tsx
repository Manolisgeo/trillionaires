"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAction } from "@/actions/auth";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signupAction, undefined);

  return (
    <AuthFrame
      quote="One workspace. Isolated by organization."
      detail="Conversations never cross tenants. Humans keep the irreversible decisions."
      footer="Consent, retention, and deletion are organization controls."
    >
      <p className="text-sm font-medium tracking-tight lg:hidden">Aperture</p>
      <h1 className="text-3xl font-medium tracking-tight">Create an organization</h1>
      <p className="mt-2 text-sm text-muted">Your conversations stay inside this workspace.</p>
      <form action={action} className="mt-8 space-y-4">
        <Field label="Name">
          <Input name="name" required autoComplete="name" />
        </Field>
        <Field label="Organization">
          <Input name="organization" required />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <Input
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
          />
        </Field>
        {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="text-ink underline">
          Sign in
        </Link>
      </p>
    </AuthFrame>
  );
}
