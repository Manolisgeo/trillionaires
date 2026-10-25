"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/client";
import { Button, Cataloguing, DemoLabel, ErrorNote, SeriesHeading } from "@/components/ui";
import type { Candidate } from "@/lib/types";
import { ClaimCard } from "./ClaimCard";

type View = Pick<Candidate, "id" | "roleId" | "research" | "profile" | "reviewedAt" | "githubHandle" | "links" | "linkedinPdfPath" | "demoData"> & { researchError?: string | null };

const card = "flex flex-col gap-2.5 border border-rule bg-card px-5 py-[18px] text-sm leading-[21px]";

export function ReviewRecord({ initial, roleTitle, company }: { initial: Candidate; roleTitle: string; company: string }) {
  const router = useRouter();
  const [c, setC] = useState<View>({ ...initial, researchError: initial.researchError ?? null });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [human, setHuman] = useState(false);
  const [pollKey, setPollKey] = useState(0);

  const waiting = c.research === "pending" || c.research === "running";
  useEffect(() => {
    if (!waiting) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const r = await api.candidates.get(c.id);
        if (alive) setC((p) => ({ ...p, research: r.research, researchError: r.researchError, profile: r.profile, reviewedAt: r.candidate.reviewedAt }));
      } catch {
        if (alive) setPollKey((k) => k + 1); // transient failure: try again
      }
    }, 2000);
    return () => { alive = false; clearTimeout(t); };
  }, [waiting, c.id, c.research, pollKey]);

  async function mutate(id: string, patch: Parameters<typeof api.candidates.patch>[1]): Promise<boolean> {
    setBusyId(id);
    setError(null);
    try {
      const next = await api.candidates.patch(c.id, patch);
      setC((p) => ({ ...p, profile: next.profile }));
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That change did not save. Try again.");
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function proceed() {
    setContinuing(true);
    setError(null);
    try {
      await api.candidates.patch(c.id, { reviewed: true });
      const interview = await api.interviews.create(c.id);
      router.push(`/room/${interview.id}`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "We could not set up your interview. Try again.");
      setContinuing(false);
    }
  }

  const claims = c.profile?.claims ?? [];
  const kept = claims.filter((x) => !x.removedByCandidate).length;

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-start gap-9 px-4 pt-9 pb-14 sm:px-7">
      <main className="flex min-w-0 flex-[999_1_600px] flex-col gap-[22px]">
        <div className="flex max-w-[64ch] flex-col gap-2.5">
          <h1 className="m-0 text-balance text-[30px] leading-[38px] font-bold">This is everything the interviewer will ask about.</h1>
          <p className="m-0 text-base leading-[25px] text-ink-2">
            Aperture read only the documents and links you gave us. Each item shows where it came from. Remove or correct anything that&apos;s wrong; nothing here is a score.
          </p>
        </div>

        {waiting ? (
          <div className="flex flex-col gap-2 border border-dashed border-rule-strong bg-card px-6 py-8">
            <Cataloguing label="Reading your documents" className="text-sm" />
            <p className="m-0 max-w-[62ch] text-sm leading-[22px] text-ink-2">This usually takes under a minute. You can stay on this page; it updates by itself.</p>
          </div>
        ) : c.research === "failed" || !c.profile ? (
          <ErrorNote
            title="We could not read your documents"
            action={
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <Link href={`/apply/${c.roleId}`} className="inline-flex min-h-11 items-center text-sm font-semibold">Upload your documents again</Link>
                <button type="button" onClick={() => setHuman(true)} className="min-h-11 cursor-pointer border-0 bg-transparent p-0 text-sm text-stamp underline underline-offset-[3px]">Ask for a human interviewer instead</button>
              </div>
            }
          >
            {c.researchError ? `${c.researchError} ` : ""}Check that your CV is a text PDF (not a scan) under 15 MB, then submit it again. Nothing was sent to the interviewer.
          </ErrorNote>
        ) : claims.length === 0 ? (
          <div className="border border-dashed border-rule-strong bg-card px-6 py-8 text-sm leading-[22px] text-ink-2">
            We did not find anything to ask about in what you provided. You can continue and the interviewer will use the role&apos;s standard questions, or upload a different CV.
          </div>
        ) : (
          <section aria-label="Catalogued items" className="flex flex-col gap-3.5">
            {claims.map((cl, i) => (
              <ClaimCard
                key={cl.id}
                claim={cl}
                index={i}
                candidate={c}
                busy={busyId === cl.id}
                onCorrect={(text) => mutate(cl.id, { corrections: [{ claimId: cl.id, text }] })}
                onRemove={() => void mutate(cl.id, { removeClaimIds: [cl.id] })}
                onRestore={() => void mutate(cl.id, { restoreClaimIds: [cl.id] })}
              />
            ))}
          </section>
        )}
        {error ? <ErrorNote title="Something went wrong">{error}</ErrorNote> : null}
      </main>

      <aside className="flex max-w-[360px] flex-[1_1_300px] flex-col gap-[18px] max-md:max-w-none">
        <section aria-labelledby="read-h" className={card}>
          <SeriesHeading as="h2" className="text-xs"><span id="read-h">What we read</span></SeriesHeading>
          <span>CV · the PDF you uploaded</span>
          <span>{c.githubHandle ? `GitHub · @${c.githubHandle} (public repositories)` : <span className="text-muted">GitHub · not provided</span>}</span>
          {c.links.map((l) => (
            <span key={l} className="break-all">{l.replace(/^https?:\/\//, "")}</span>
          ))}
          <span className={c.linkedinPdfPath ? "" : "text-muted"}>LinkedIn export · {c.linkedinPdfPath ? "provided" : "not provided"}</span>
          <span className="border-t border-rule-faint pt-2.5 text-[13px] text-ink-2">We did not search the web for you beyond these links.</span>
        </section>

        <section aria-labelledby="next-h" className={card}>
          <SeriesHeading as="h2" className="text-xs"><span id="next-h">The interview</span></SeriesHeading>
          <span>About 40 minutes with Aperture, an AI interviewer, for the {roleTitle} role. It is recorded, captioned, and reviewed by a person at {company}, who makes the decision.</span>
          <span>You can say &quot;I&apos;m finished&quot; or press a button when you&apos;re done answering, and ask for extra think time.</span>
        </section>

        {human ? (
          <section role="status" className="flex flex-col gap-2 border border-rule bg-card px-5 py-[18px] text-sm leading-[21px]">
            <b>Your preference for a human interviewer is noted.</b>
            <span>Reply to the message {company} sent you and ask them to arrange a person. The AI interview will not start unless you choose to continue.</span>
            <button type="button" onClick={() => setHuman(false)} className="min-h-11 cursor-pointer self-start border-0 bg-transparent p-0 text-sm text-stamp underline underline-offset-[3px]">Go back to the AI interview option</button>
          </section>
        ) : (
          <>
            <Button size={48} busy={continuing} disabled={c.research !== "done" || !c.profile} onClick={() => void proceed()} className="w-full">
              {continuing ? "Setting up your interview…" : "Looks right — continue to interview"}
            </Button>
            {c.profile && kept < claims.length ? <p className="m-0 text-center text-[13px] text-muted">{claims.length - kept} item{claims.length - kept === 1 ? "" : "s"} removed. The interviewer will not ask about them.</p> : null}
            <button type="button" onClick={() => setHuman(true)} className="min-h-11 cursor-pointer border-0 bg-transparent p-0 text-center text-sm text-stamp underline underline-offset-[3px] hover:text-stamp-deep">
              I&apos;d prefer a human interviewer
            </button>
          </>
        )}
        {c.demoData ? <DemoLabel className="self-center" /> : null}
      </aside>
    </div>
  );
}
