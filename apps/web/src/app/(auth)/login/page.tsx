"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/actions/auth";
import { AuthFrame } from "@/components/auth/auth-frame";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <AuthFrame
      quote="Every conversation, turned into evidence."
      detail="A realtime AI participant that listens, follows up, and produces a structured report — facts separated from inference."
      footer="The AI is always disclosed. Recording is never silent."
    >
      <p className="text-sm font-medium tracking-tight lg:hidden">Kimma</p>
      <h1 className="text-3xl font-medium tracking-tight">Sign in</h1>
      <p className="mt-2 text-sm text-muted">Conversation intelligence for teams.</p>
      <form action={action} className="mt-8 space-y-4">
        <Field label="Email">
          <Input name="email" type="email" required autoComplete="email" />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" required autoComplete="current-password" />
        </Field>
        {state?.error ? <p className="text-sm text-red-700">{state.error}</p> : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in…" : "Continue"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-muted">
        No account?{" "}
        <Link href="/signup" className="text-ink underline">
          Create one
        </Link>
      </p>
    </AuthFrame>
  );
}
