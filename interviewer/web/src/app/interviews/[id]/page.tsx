import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogCard, DemoLabel, MonoReadout, SeriesHeading, Stamp } from "@/components/ui";
import { InterviewActions } from "@/components/recruiter/InterviewActions";
import { PageTitle, RecruiterShell } from "@/components/recruiter/Shell";
import { interviewStatusLabel } from "@/components/recruiter/status";
import { callNo, formatDateTime, roman } from "@/lib/format";
import { questionLabel } from "@/lib/questions";
import { store } from "@/lib/store";
import type { BriefBucket, Source } from "@/lib/types";

export const dynamic = "force-dynamic";

const BUCKETS: { key: BriefBucket; label: string; blurb: string }[] = [
  { key: "matched", label: "Matched", blurb: "Claims with a source that meet a requirement." },
  { key: "unverified", label: "Unverified", blurb: "Claims the interview should test." },
  { key: "gap", label: "Gap", blurb: "Requirements with no evidence in the record." },
  { key: "flag", label: "Flag", blurb: "Inconsistencies or open questions in the record." },
];
const SOURCE_LABEL: Record<Source["kind"], string> = { cv: "CV", linkedin: "LinkedIn", github: "GitHub", web: "Web" };

function Quote({ source }: { source: Source }) {
  return (
    <blockquote className="m-0 flex flex-col gap-1 bg-board px-3 py-2 text-[13px] leading-5 text-ink-2">
      <span>&ldquo;{source.quote}&rdquo;</span>
      <span className="font-mono text-xs text-muted">
        {SOURCE_LABEL[source.kind]}
        {source.page ? ` · p.${source.page}` : ""}
        {source.url ? (
          <>
            {" · "}
            <a href={source.url} target="_blank" rel="noreferrer">
              open source
            </a>
          </>
        ) : null}
      </span>
    </blockquote>
  );
}

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const interview = await store.interviews.get((await params).id);
  if (!interview) notFound();
  const [role, candidate] = await Promise.all([store.roles.get(interview.roleId), store.candidates.get(interview.candidateId)]);
  if (!role || !candidate) notFound();

  const profile = role.profile;
  const names = new Map<string, string>();
  profile?.competencies.forEach((c) => names.set(c.id, c.name));
  [...(profile?.mustHave ?? []), ...(profile?.niceToHave ?? [])].forEach((s) => names.set(s.id, s.name));
  const claims = new Map((candidate.profile?.claims ?? []).map((c) => [c.id, c]));
  const demo = role.demoData || candidate.demoData || interview.report?.demoData;
  const ivNo = callNo.interview(interview.id, interview.createdAt);

  return (
    <RecruiterShell current="none">
      <PageTitle
        tag={`${ivNo} · ${callNo.candidate(candidate.id)} · ${callNo.role(role.id)}`}
        title={candidate.name}
        actions={undefined}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <Link href={`/roles/${role.id}`} className="text-ink">
          {role.title}, {role.company}
        </Link>
        <Stamp variant={interview.status === "failed" ? "neutral" : "ai"} rotate={-1.5}>
          {interviewStatusLabel[interview.status]}
        </Stamp>
        <MonoReadout tone="muted">{interview.mode === "meet" ? "Google Meet" : "Kimma room"}</MonoReadout>
        <MonoReadout tone="muted">Prepared {formatDateTime(interview.createdAt)}</MonoReadout>
        {demo ? <DemoLabel /> : null}
      </div>

      <section aria-label="Actions" className="border border-rule border-t-[3px] border-t-redline bg-card px-5 py-5 sm:px-6">
        <InterviewActions id={interview.id} status={interview.status} meetUrl={interview.meetUrl} hasReport={Boolean(interview.report)} />
      </section>

      <section aria-label="Brief" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <SeriesHeading>BRIEF · THE RECORD AGAINST THE RUBRIC</SeriesHeading>
          <p className="m-0 max-w-[65ch] text-sm text-muted">What Kimma found before the call. Every item cites its source; the interview checks them with the candidate.</p>
        </div>
        {BUCKETS.map((b) => {
          const items = interview.brief.items.filter((i) => i.bucket === b.key);
          if (!items.length) return null;
          return (
            <div key={b.key} className="flex flex-col gap-3">
              <h3 className="m-0 font-mono text-[13px] font-bold tracking-[0.1em] text-ink">
                {b.label.toUpperCase()} · {items.length} <span className="font-normal text-muted">{b.blurb}</span>
              </h3>
              <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))]">
                {items.map((it, i) => {
                  const claim = it.claimId ? claims.get(it.claimId) : undefined;
                  const subject = it.skillOrCompetencyId ? names.get(it.skillOrCompetencyId) : undefined;
                  return (
                    <CatalogCard
                      key={i}
                      callNo={`B-${String(i + 1).padStart(2, "0")}`}
                      kicker={b.label.toUpperCase()}
                      source={claim ? SOURCE_LABEL[claim.source.kind] : undefined}
                      dashed={b.key === "gap"}
                    >
                      {subject ? <b className="text-sm">{subject}</b> : null}
                      <p className="m-0 text-sm leading-[21px]">{it.note}</p>
                      {claim ? (
                        <>
                          <p className="m-0 text-[13px] text-ink-2">Claim: {claim.text}</p>
                          <Quote source={claim.source} />
                        </>
                      ) : null}
                    </CatalogCard>
                  );
                })}
              </div>
            </div>
          );
        })}
        {interview.brief.items.length === 0 ? <p className="m-0 text-sm text-muted">The brief is empty.</p> : null}
      </section>

      <section aria-label="Interview plan" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SeriesHeading>PLAN · PHASES AND QUESTIONS</SeriesHeading>
          <MonoReadout tone="muted">{interview.plan.phases.reduce((n, p) => n + p.minutes, 0)} min total</MonoReadout>
        </div>
        <ol className="m-0 flex list-none flex-col gap-4 p-0">
          {interview.plan.phases.map((p, pi) => {
            const problem = p.problemId ? profile?.problems.find((x) => x.id === p.problemId) : undefined;
            return (
              <li key={p.phase} className="flex flex-col gap-3 border border-rule bg-card px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink pb-2.5">
                  <h3 className="m-0 text-sm font-bold uppercase tracking-[0.06em]">
                    {roman(pi + 1)} · {p.phase}
                  </h3>
                  <MonoReadout tone="muted">{p.minutes} min</MonoReadout>
                </div>
                {p.objectives.length ? (
                  <ul className="m-0 flex list-disc flex-col gap-0.5 pl-5 text-sm leading-[21px] text-ink-2">
                    {p.objectives.map((o, oi) => (
                      <li key={oi}>{o}</li>
                    ))}
                  </ul>
                ) : null}
                {problem ? <p className="m-0 text-sm">Board problem: <b>{problem.title}</b></p> : null}
                {p.questions.length ? (
                  <ol className="m-0 flex list-none flex-col gap-3 p-0">
                    {p.questions.map((q, qi) => (
                      <li key={q.id} className="flex flex-col gap-1.5 text-sm leading-[21px]">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="font-mono text-stamp">{questionLabel(interview.plan, q.id) ?? callNo.question(pi + 1, qi + 1)}</span>
                          <Stamp variant={q.kind === "core" ? "neutral" : "ai"}>{q.kind}</Stamp>
                          {q.competencyId && names.get(q.competencyId) ? <span className="font-mono text-xs text-muted">{names.get(q.competencyId)}</span> : null}
                        </div>
                        <span>{q.text}</span>
                        {q.source ? <Quote source={q.source} /> : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="m-0 text-sm text-muted">No scripted questions in this phase.</p>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </RecruiterShell>
  );
}
