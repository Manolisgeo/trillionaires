import type { ReactNode } from "react";
import { Stamp } from "@/components/ui";
import type { Candidate, Interview, Role } from "@/lib/types";

export function roleStamp(status: Role["status"]): ReactNode {
  if (status === "approved") return <Stamp variant="neutral" rotate={-1.5}>Rubric approved</Stamp>;
  if (status === "draft") return <Stamp variant="ai" rotate={-1.5}>Drafted by AI · needs review</Stamp>;
  return <Stamp variant="dashed" rotate={-1.5}>Drafting</Stamp>;
}

/** Latest interview of a candidate (by createdAt). */
export function latestInterview(candidateId: string, interviews: Interview[]): Interview | null {
  return interviews.filter((i) => i.candidateId === candidateId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export function candidateStamp(c: Candidate, iv: Interview | null): ReactNode {
  if (iv) {
    if (iv.status === "done" && iv.report) return <Stamp variant="ai">For review</Stamp>;
    if (iv.status === "done" || iv.status === "processing") return <Stamp variant="dashed">Scoring</Stamp>;
    if (iv.status === "live")
      return (
        <span className="inline-flex w-fit items-center rounded-[3px] bg-ink px-2 py-0.5 text-[11px] font-bold tracking-[0.1em] text-white uppercase">Interview live</span>
      );
    if (iv.status === "failed") return <Stamp variant="neutral">Interview failed</Stamp>;
    return <Stamp variant="neutral">Interview scheduled</Stamp>;
  }
  if (c.research === "pending" || c.research === "running") return <Stamp variant="dashed">Researching</Stamp>;
  if (c.research === "failed") return <Stamp variant="neutral">Research failed</Stamp>;
  if (c.reviewedAt) return <Stamp variant="neutral">Record reviewed</Stamp>;
  return <Stamp variant="dashed">Awaiting candidate review</Stamp>;
}

export const suggestion = (iv: Interview | null): string | null =>
  iv?.report ? (iv.report.recommendation === "advance" ? "Advance" : "Needs human review") : null;

export const interviewStatusLabel: Record<Interview["status"], string> = {
  scheduled: "Scheduled",
  live: "Live",
  processing: "Scoring",
  done: "Done",
  failed: "Failed",
};
