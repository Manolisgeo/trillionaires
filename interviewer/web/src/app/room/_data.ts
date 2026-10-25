import { env } from "@/lib/env";
import { callNo } from "@/lib/format";
import { store } from "@/lib/store";
import type { RoomData } from "@/components/room/types";

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "candidate";

/** Server-only: reads the store directly and returns a serializable snapshot for the room and the bot bridge. */
export async function loadRoomData(id: string): Promise<RoomData | null> {
  const interview = await store.interviews.get(id);
  if (!interview) return null;
  const [role, candidate] = await Promise.all([store.roles.get(interview.roleId), store.candidates.get(interview.candidateId)]);
  if (!role || !candidate) return null;

  const criterionNames: Record<string, string> = {};
  for (const c of role.profile?.competencies ?? []) criterionNames[c.id] = c.name;
  for (const s of [...(role.profile?.mustHave ?? []), ...(role.profile?.niceToHave ?? [])]) criterionNames[s.id] = s.name;

  const handle = candidate.githubHandle?.replace(/^@/, "").trim() || null;
  const firstLink = candidate.links.find((l) => /^https?:\/\//i.test(l)) ?? null;
  const base = (env("PUBLIC_BASE_URL") ?? "http://localhost:3000").replace(/\/$/, "");

  return {
    interviewId: interview.id,
    callNo: callNo.interview(interview.id, interview.createdAt),
    status: interview.status,
    mode: interview.mode,
    role: { title: role.title, company: role.company },
    candidate: { name: candidate.name, firstName: candidate.name.trim().split(/\s+/)[0] ?? candidate.name, consentAt: candidate.consentAt },
    demo: Boolean(interview.report?.demoData || role.demoData || candidate.demoData),
    cv: candidate.cvPath ? { url: `/api/files/${candidate.cvPath.split("/").map(encodeURIComponent).join("/")}`, label: `${slug(candidate.name)}.pdf` } : null,
    plan: interview.plan,
    criterionNames,
    github: handle ? { handle, url: `https://github.com/${handle}` } : null,
    firstLink,
    publicBaseUrl: base,
  };
}
