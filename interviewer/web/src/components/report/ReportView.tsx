"use client";

import { useRef, useState } from "react";
import { Button, DemoLabel, EvidenceQuote, RatingScale, Stamp } from "@/components/ui";
import { callNo, formatDate, interviewDuration } from "@/lib/format";
import type { Candidate, Interview, Report, Role } from "@/lib/types";
import { mmss } from "@/lib/format";
import { questionForEvidence } from "@/lib/questions";
import { describeSource, transcriptTag, weightFor } from "./citations";
import { Decision } from "./Decision";
import { Player, type PlayerHandle } from "./Player";

const kicker = "font-mono text-xs tracking-[0.12em] text-muted";

function nextRoundQuestion(report: Report, name: string, nth: number): string | null {
  const words = name.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const hit = report.openQuestions.find((q) => words.some((w) => q.toLowerCase().includes(w)));
  return hit ?? report.openQuestions[nth] ?? null;
}

export function ReportView({ interview, role, candidate, report }: { interview: Interview; role: Role; candidate: Candidate; report: Report }) {
  const player = useRef<PlayerHandle>(null);
  const [deciding, setDeciding] = useState(false);
  const advance = report.recommendation === "advance";
  const lastEnd = interview.transcript.reduce((m, s) => Math.max(m, s.end), 0);
  const duration = interviewDuration(interview);
  const date = formatDate(interview.startedAt ?? report.createdAt);
  const demo = report.demoData || interview.report?.demoData || candidate.demoData || role.demoData;
  let nullIdx = 0;

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-wrap items-start gap-8 px-4 pt-8 pb-14 sm:px-7 print:block print:p-0">
      <style>{`@media print{header,.no-print{display:none !important}body{background:#fff}a{color:inherit}details>*{display:block}}`}</style>
      <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="m-0 text-[26px] leading-[34px] font-bold text-balance sm:text-3xl sm:leading-[38px]">
              {candidate.name} <span className="font-normal text-muted">— {role.title}, {role.company}</span>
            </h1>
            <span className="font-mono text-[13px] tracking-[0.04em] whitespace-nowrap text-muted">{callNo.interview(interview.id, interview.createdAt)}</span>
          </div>
          <span className="text-sm text-muted">
            Interviewed by Aperture (AI) on {date}{duration ? `, ${duration}` : ""}. Draft for human review. Ratings of 4 are reserved for people.
          </span>
        </div>

        <section aria-label="Suggestion" className="flex flex-wrap items-center gap-5 border border-rule border-t-[3px] border-t-redline bg-card px-5 py-5 sm:px-6">
          <Stamp variant="ai" size="lg" rotate={-2} className="flex-col gap-0.5">
            <span className="font-mono text-[11px] tracking-[0.16em]">{advance ? "SUGGESTED" : "NEEDS HUMAN"}</span>
            <span>{advance ? "ADVANCE" : "REVIEW"}</span>
          </Stamp>
          <p className="m-0 min-w-[240px] flex-[1_1_360px] text-[15px] leading-[23px]">
            {report.recommendationReason} <b>A person makes the decision.</b>
          </p>
          <div className="no-print flex flex-wrap gap-2">
            <Button onClick={() => setDeciding(true)} aria-expanded={deciding}>
              Record my decision
            </Button>
            <Button variant="secondary" onClick={() => window.print()}>
              Export
            </Button>
          </div>
          <Decision interviewId={interview.id} open={deciding} onClose={() => setDeciding(false)} />
        </section>

        <section aria-labelledby="scope" className="flex flex-col gap-2">
          <h2 id="scope" className="m-0 font-mono text-[13px] font-bold tracking-[0.14em] text-ink-2">
            SCOPE NOTE
          </h2>
          <p className="m-0 max-w-[72ch] text-[15px] leading-6">{report.summary}</p>
        </section>

        <section aria-label="Criteria" className="flex flex-col border-t-2 border-ink">
          {report.criteria.map((c, i) => {
            const w = weightFor(role, c.criterionId);
            const cites = c.evidence.map((e) => questionForEvidence(interview, e, c.criterionId));
            const cite = cites.find((x) => x !== null) ?? null;
            const ask = c.rating === null ? nextRoundQuestion(report, c.name, nullIdx++) : null;
            return (
              <article key={c.criterionId} className="flex flex-col gap-2.5 border-b border-rule pt-[18px] pb-5 text-sm leading-[21px]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    <span className="font-mono text-muted">{`C-${String(i + 1).padStart(2, "0")}`}</span> <b className="tracking-[0.06em] uppercase">{c.name}</b>
                    {w !== null ? <span className="text-muted"> · weight {w}</span> : null}
                  </span>
                  {c.rating === null ? (
                    <Stamp variant="neutral" rotate={-1.5} className="px-2.5 py-[3px] text-xs tracking-[0.1em]">
                      Insufficient evidence
                    </Stamp>
                  ) : (
                    <RatingScale rating={c.rating} />
                  )}
                </div>
                <p className="m-0 max-w-[72ch]">{c.rationale}</p>
                {c.evidence.length ? (
                  <div className="flex flex-col gap-1.5">
                    {c.evidence.map((e, k) => (
                      <EvidenceQuote
                        key={`${e.segmentId}-${k}`}
                        t={e.t}
                        quote={e.quote}
                        tag={cites[k]?.label ?? null}
                        line={transcriptTag(interview, e.segmentId)}
                        onSeek={interview.recording ? (t) => player.current?.seekAndPlay(t) : undefined}
                      />
                    ))}
                  </div>
                ) : null}
                {cite ? (
                  <span className="font-mono text-xs text-muted">
                    <b className="text-stamp">{cite.label}</b> asked as {describeSource(cite.question)}
                  </span>
                ) : null}
                {ask ? (
                  <span>
                    <b>Ask in the next round:</b> &ldquo;{ask}&rdquo;
                  </span>
                ) : null}
              </article>
            );
          })}
        </section>

        <section aria-label="Full transcript" className="flex flex-col">
          <details className="group border border-rule bg-card">
            <summary className="flex min-h-11 cursor-pointer items-center px-4 font-mono text-[13px] font-bold tracking-[0.14em] text-ink-2">
              FULL TRANSCRIPT · {interview.transcript.length} LINES
            </summary>
            <ol className="m-0 flex list-none flex-col gap-2 border-t border-rule p-4 text-sm leading-[21px]">
              {interview.transcript.map((s) => (
                <li key={s.id} id={`seg-${s.id}`} className="flex gap-3">
                  <span className="flex-none font-mono text-muted tabular-nums">{mmss(s.start)}</span>
                  <span className={s.speaker === "agent" ? "text-stamp" : "text-ink"}>
                    <b className="mr-1.5 text-xs tracking-[0.08em] uppercase">{s.speaker === "agent" ? "Aperture" : "Candidate"}</b>
                    {s.text}
                  </span>
                </li>
              ))}
              {interview.transcript.length === 0 ? <li className="text-muted">No transcript was captured.</li> : null}
            </ol>
          </details>
        </section>
      </main>

      <aside className="flex max-w-[380px] min-w-0 flex-[1_1_320px] flex-col gap-5 max-md:max-w-none print:mt-6 print:max-w-none">
        <section aria-label="Recording" className="no-print border border-rule bg-card px-[18px] py-4">
          {interview.recording ? (
            <Player ref={player} url={interview.recording.url} offsetSec={interview.recording.offsetSec} fallbackDuration={lastEnd} />
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className={kicker}>RECORDING</span>
              <p className="m-0 text-[13px] leading-5 text-muted">No recording is attached to this interview, so quotes cannot be played. Timecodes still refer to the transcript.</p>
            </div>
          )}
        </section>

        <section aria-label="Strengths, concerns and open questions" className="flex flex-col gap-2.5 border border-rule bg-card px-[18px] py-4 text-sm leading-[21px]">
          {(
            [
              ["STRENGTHS", report.strengths],
              ["CONCERNS", report.concerns],
              ["OPEN QUESTIONS", report.openQuestions],
            ] as const
          ).map(([label, items], n) => (
            <div key={label} className={`flex flex-col gap-1.5 ${n ? "mt-1.5" : ""}`}>
              <h2 className={`m-0 ${kicker} font-normal`}>{label}</h2>
              {items.length ? items.map((t, k) => <span key={k}>{t}</span>) : <span className="text-muted">None recorded.</span>}
            </div>
          ))}
        </section>

        <section aria-label="Integrity notes" className="flex flex-col gap-1.5 border border-dashed border-rule-strong px-[18px] py-3.5 text-[13px] leading-5 text-ink-2">
          <h2 className={`m-0 ${kicker} font-normal`}>INTEGRITY NOTES · METADATA, NOT A VERDICT</h2>
          {report.integrityNotes.length ? report.integrityNotes.map((t, k) => <span key={k}>{t}</span>) : <span>No integrity signals were recorded.</span>}
        </section>

        {demo ? <DemoLabel /> : null}
      </aside>
    </div>
  );
}
