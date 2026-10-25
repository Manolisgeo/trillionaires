"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button, ButtonLink, ErrorNote, Input } from "@/components/ui";
import { ApiError, api } from "@/lib/client";
import { CopyButton } from "./CopyButton";

export function InterviewActions({ id, status, meetUrl, hasReport }: { id: string; status: string; meetUrl: string | null; hasReport: boolean }) {
  const router = useRouter();
  const [url, setUrl] = useState(meetUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ status: number; message: string } | null>(null);
  const [sent, setSent] = useState(Boolean(meetUrl));

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api.interviews.meet(id, url.trim());
      setSent(true);
      router.refresh();
    } catch (e2) {
      setErr({ status: e2 instanceof ApiError ? e2.status : 0, message: e2 instanceof Error ? e2.message : "Could not reach the server" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <CopyButton path={`/room/${id}`} label="Copy candidate room link" />
        <ButtonLink variant="secondary" href={`/room/${id}?preview=1`}>
          Preview the room
        </ButtonLink>
        {hasReport ? <ButtonLink href={`/reports/${id}`}>Open the report</ButtonLink> : null}
      </div>

      <form onSubmit={send} className="flex max-w-[640px] flex-col gap-3 border-t border-rule-faint pt-5">
        <Input
          label="Google Meet link"
          type="url"
          inputMode="url"
          placeholder="https://meet.google.com/abc-defg-hij"
          hint="Aperture joins the call as an AI interviewer, shares its screen and records, with a notice in the meeting chat."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={status !== "scheduled" || sent}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="secondary" busy={busy} disabled={status !== "scheduled" || sent || !url.trim()}>
            Send to Google Meet
          </Button>
          {sent ? <span role="status" className="font-mono text-[13px] text-ink-2">Interviewer dispatched to the meeting.</span> : null}
          {status !== "scheduled" && !sent ? <span className="text-[13px] text-muted">Only a scheduled interview can be sent to a meeting.</span> : null}
        </div>
        {err ? (
          <ErrorNote title={err.status === 503 ? "Google Meet is not set up on this server" : "The interviewer was not sent"}>
            {err.message}
            {err.status === 503 ? " The candidate can still join through the room link above." : ""}
          </ErrorNote>
        ) : null}
      </form>
    </div>
  );
}
