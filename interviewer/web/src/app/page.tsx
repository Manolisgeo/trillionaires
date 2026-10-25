import Link from "next/link";
import { ButtonLink, DemoLabel, EmptyState, Ledger, LedgerHead, LedgerRow, LedgerTd, LedgerTh, Stamp } from "@/components/ui";
import { PrepareInterviewButton } from "@/components/recruiter/PrepareInterviewButton";
import { PageTitle, RecruiterShell } from "@/components/recruiter/Shell";
import { candidateStamp, latestInterview, roleStamp, suggestion } from "@/components/recruiter/status";
import { callNo, formatDateTime } from "@/lib/format";
import { store } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Catalog() {
  const [roles, candidates, interviews] = await Promise.all([store.roles.list(), store.candidates.list(), store.interviews.list()]);
  const byNew = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt);
  const rolesSorted = [...roles].sort(byNew);
  const roleOf = new Map(roles.map((r) => [r.id, r]));

  const rows = candidates.map((c) => {
    const iv = latestInterview(c.id, interviews);
    return { c, iv, updated: iv?.endedAt ?? iv?.startedAt ?? iv?.createdAt ?? c.createdAt };
  });
  rows.sort((a, b) => b.updated.localeCompare(a.updated));
  // One synthetic label for the page. Per-item labels appear only where the data differs from the rest.
  const demoRole = (r: (typeof roles)[number]) => Boolean(r.demoData);
  const demoCand = (c: (typeof candidates)[number]) => Boolean(c.demoData);
  const allDemo = roles.every(demoRole) && candidates.every(demoCand);
  const demo = roles.some(demoRole) || candidates.some(demoCand) || interviews.some((i) => i.report?.demoData);

  return (
    <RecruiterShell current="catalog">
      <PageTitle
        tag={`${rolesSorted.length} ${rolesSorted.length === 1 ? "collection" : "collections"} · ${candidates.length} ${candidates.length === 1 ? "record" : "records"}`}
        title="Catalog"
        actions={<ButtonLink href="/roles/new">New role from a job description</ButtonLink>}
      />
      {demo && allDemo ? <Stamp variant="dashed" className="-mt-3 self-start">Synthetic demo data</Stamp> : null}

      {rolesSorted.length === 0 ? (
        <EmptyState
          title="The catalog is empty"
          action={<ButtonLink href="/roles/new">New role from a job description</ButtonLink>}
        >
          Paste a job description and Aperture drafts the rubric: competencies, anchors and the core questions every candidate will be asked. You approve it before any candidate sees a link.
        </EmptyState>
      ) : (
        <section aria-label="Collections" className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
          {rolesSorted.map((r) => {
            const recs = candidates.filter((c) => c.roleId === r.id);
            const ivs = interviews.filter((i) => i.roleId === r.id);
            const interviewed = ivs.filter((i) => i.status === "done" || i.status === "processing" || i.status === "live").length;
            const review = ivs.filter((i) => i.status === "done" && i.report).length;
            const dashed = r.status !== "approved";
            return (
              <Link
                key={r.id}
                href={`/roles/${r.id}`}
                className={`flex flex-col gap-3.5 bg-card px-5 py-[18px] text-ink no-underline hover:border-ink-2 hover:text-ink ${dashed ? "border border-dashed border-rule-strong" : "border border-rule"}`}
              >
                <span className="flex items-baseline justify-between gap-3 border-b border-rule pb-3">
                  <span className="text-base leading-6 font-bold">{r.title}</span>
                  <span className="font-mono text-xs whitespace-nowrap text-muted">{callNo.role(r.id)}</span>
                </span>
                <span className="flex justify-between gap-2 font-mono text-[13px] text-ink-2">
                  <span>{recs.length} {recs.length === 1 ? "record" : "records"}</span>
                  <span>{interviewed ? `${interviewed} interviewed` : "—"}</span>
                  <span className={review ? "font-bold text-stamp" : ""}>{review ? `${review} for review` : "—"}</span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  {roleStamp(r.status)}
                  {r.demoData && !allDemo ? <DemoLabel /> : null}
                </span>
              </Link>
            );
          })}
        </section>
      )}

      {rows.length === 0 ? (
        <Ledger title="LEDGER" aside="Newest first" minWidth={0}>
          <tbody>
            <LedgerRow>
              <LedgerTd className="px-5 py-6 text-muted">
                No candidates yet. Once a role rubric is approved, share its application link and each applicant appears here.
              </LedgerTd>
            </LedgerRow>
          </tbody>
        </Ledger>
      ) : (
        <>
          {/* Phones: each record is a stacked slip, so the status and the AI suggestion are never off-screen. */}
          <section aria-label="Ledger" className="border border-rule bg-card sm:hidden">
            <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-4 py-3.5">
              <h2 className="m-0 font-mono text-[13px] font-bold tracking-[0.14em]">LEDGER</h2>
              <span className="text-sm text-muted">Newest first</span>
            </div>
            <ul className="m-0 flex list-none flex-col p-0">
              {rows.map(({ c, iv, updated }) => {
                const href = iv ? (iv.status === "done" && iv.report ? `/reports/${iv.id}` : `/interviews/${iv.id}`) : null;
                const sug = suggestion(iv);
                return (
                  <li key={c.id} className="flex flex-col gap-2 border-b border-rule-faint px-4 py-3 last:border-b-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-mono text-[13px] whitespace-nowrap text-muted">{callNo.candidate(c.id)}</span>
                      <span className="font-mono text-xs whitespace-nowrap text-muted">{formatDateTime(updated)}</span>
                    </div>
                    {href ? (
                      <Link href={href} className="inline-flex min-h-11 items-center text-base font-semibold text-ink underline decoration-rule-strong hover:text-stamp-deep">
                        {c.name}
                      </Link>
                    ) : (
                      <span className="text-base font-semibold">{c.name}</span>
                    )}
                    <span className="text-sm text-ink-2">{roleOf.get(c.roleId)?.title ?? "Unknown role"}</span>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                      {candidateStamp(c, iv)}
                      {sug ? <span className="text-sm font-semibold">{sug}</span> : null}
                    </div>
                    {!iv && c.research === "done" ? <PrepareInterviewButton candidateId={c.id} /> : null}
                  </li>
                );
              })}
            </ul>
          </section>

          <Ledger title="LEDGER" aside="Newest first" minWidth={820} className="hidden sm:block">
            <LedgerHead>
              <LedgerTh mono>CALL NO.</LedgerTh>
              <LedgerTh>Candidate</LedgerTh>
              <LedgerTh>Role</LedgerTh>
              <LedgerTh>Status</LedgerTh>
              <LedgerTh>AI suggestion</LedgerTh>
              <LedgerTh mono>UPDATED</LedgerTh>
            </LedgerHead>
            <tbody>
              {rows.map(({ c, iv, updated }) => {
                const href = iv ? (iv.status === "done" && iv.report ? `/reports/${iv.id}` : `/interviews/${iv.id}`) : null;
                const sug = suggestion(iv);
                return (
                  <LedgerRow key={c.id}>
                    <LedgerTd mono>{callNo.candidate(c.id)}</LedgerTd>
                    <LedgerTd className="font-semibold">
                      {href ? (
                        <Link href={href} className="inline-flex min-h-11 items-center text-ink underline decoration-rule-strong hover:text-stamp-deep">
                          {c.name}
                        </Link>
                      ) : (
                        c.name
                      )}
                      {c.demoData && !allDemo ? <span className="ml-2 font-mono text-[11px] font-normal text-muted">synthetic</span> : null}
                    </LedgerTd>
                    <LedgerTd>{roleOf.get(c.roleId)?.title ?? "Unknown role"}</LedgerTd>
                    <LedgerTd>
                      <div className="flex flex-col items-start gap-2">
                        {candidateStamp(c, iv)}
                        {!iv && c.research === "done" ? <PrepareInterviewButton candidateId={c.id} /> : null}
                      </div>
                    </LedgerTd>
                    <LedgerTd className={sug ? "font-semibold" : "text-muted"}>{sug ?? "—"}</LedgerTd>
                    <LedgerTd mono>{formatDateTime(updated)}</LedgerTd>
                  </LedgerRow>
                );
              })}
            </tbody>
          </Ledger>
        </>
      )}
    </RecruiterShell>
  );
}
