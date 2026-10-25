"use client";

import { Button, CatalogCard } from "@/components/ui";
import { formatDate } from "@/lib/format";
import type { RecordingView, RoomData } from "./types";

export type EndReason = "ended" | "left" | "dropped" | "closed";

/** After the call. Calm, plain, and honest about what was saved. */
export function Completion({ data, reason, recording, onRejoin }: { data: RoomData; reason: EndReason; recording?: RecordingView; onRejoin?: () => void }) {
  const title =
    reason === "ended" || reason === "closed"
      ? `Thank you — a person at ${data.role.company} will review this.`
      : reason === "left"
        ? "You left the interview."
        : "The connection dropped.";
  const body =
    reason === "ended" || reason === "closed"
      ? `Aperture is an AI and does not decide anything. The recording and transcript go to a person at ${data.role.company}, who reads the report and chooses what happens next.`
      : reason === "left"
        ? `What was said so far is saved and goes to a person at ${data.role.company}. You can come back with the same link and carry on.`
        : `What was said so far is saved. Rejoin with the same link to carry on, or close this page if you are done.`;
  const rec =
    recording?.state === "saved"
      ? "Recording saved."
      : recording?.state === "failed"
        ? "The recording did not upload. The transcript is still kept."
        : recording?.state === "unsupported"
          ? "This browser could not record audio. The transcript is still kept."
          : null;
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex min-h-14 flex-wrap items-center gap-x-3.5 bg-hollinger px-4 py-2 text-white sm:px-7">
        <span className="text-sm font-bold tracking-[0.14em]">APERTURE</span>
        <span className="font-mono text-sm text-rule-strong">
          {data.callNo} · {data.role.title} · {data.role.company}
        </span>
      </header>
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col justify-center gap-6 px-4 py-12 sm:px-8">
        <CatalogCard kicker={`CLOSED ${formatDate(new Date().toISOString())}`} right="NO ACTION NEEDED" aria-label="Interview complete">
          <h1 className="m-0 max-w-[26ch] text-[26px] leading-9 font-bold text-balance">{title}</h1>
          <p className="m-0 max-w-[62ch] text-[15px] leading-6 text-ink-2">{body}</p>
          {rec ? <p className="m-0 font-mono text-[13px] text-muted">{rec}</p> : null}
          {onRejoin && reason !== "ended" && reason !== "closed" ? (
            <div className="pt-2">
              <Button size={48} onClick={onRejoin}>
                Rejoin the interview
              </Button>
            </div>
          ) : null}
        </CatalogCard>
      </main>
    </div>
  );
}
