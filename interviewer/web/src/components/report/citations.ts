import type { Interview, PlannedQuestion, Role } from "@/lib/types";

/** Transcript call number of a segment ("T-004"), by its place in the transcript. */
export function transcriptTag(interview: Interview, segmentId: string): string | null {
  const i = interview.transcript.findIndex((s) => s.id === segmentId);
  return i < 0 ? null : `T-${String(i + 1).padStart(3, "0")}`;
}

export function weightFor(role: Role, criterionId: string): number | null {
  const p = role.profile;
  if (!p) return null;
  return p.competencies.find((c) => c.id === criterionId)?.weight ?? [...p.mustHave, ...p.niceToHave].find((s) => s.id === criterionId)?.weight ?? null;
}

export function describeSource(q: PlannedQuestion): string {
  const s = q.source;
  if (!s) return q.kind === "core" ? "core question, the same for every candidate" : "probe";
  const where = s.kind === "cv" ? `CV${s.page ? ` p.${s.page}` : ""}` : s.kind === "github" ? "GitHub" : s.kind === "linkedin" ? "LinkedIn" : "web";
  return `${q.kind} on ${where}`;
}
