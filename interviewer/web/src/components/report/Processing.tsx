"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { Cataloguing, ErrorNote } from "@/components/ui";

/** Polls the interview until its report exists, then refreshes the server component. */
export function Processing({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const failed = status === "failed";
  useEffect(() => {
    if (failed) return;
    const timer = setInterval(async () => {
      try {
        const { interview } = await api.interviews.get(id);
        if (interview.report || interview.status === "done" || interview.status === "failed") router.refresh();
      } catch {
        /* keep polling */
      }
    }, 3000);
    return () => clearInterval(timer);
  }, [id, failed, router]);

  if (failed) {
    return (
      <ErrorNote title="The report could not be produced.">
        Scoring failed for this interview. The transcript is kept. Ask the owner to re-run scoring, then reload this page.
      </ErrorNote>
    );
  }
  const waiting = status === "scheduled" || status === "live";
  return (
    <div className="flex flex-col gap-3 border border-rule bg-card px-6 py-8">
      <Cataloguing label={waiting ? "Interview not finished yet" : "Cataloguing the interview"} />
      <p className="m-0 max-w-[62ch] text-sm leading-[22px] text-ink-2">
        {waiting
          ? "The finding aid is written once the interview ends. This page checks again every few seconds."
          : "Each rating is being traced to a quote and a timecode. This usually takes under a minute, and this page updates by itself."}
      </p>
    </div>
  );
}
