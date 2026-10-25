import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";
import { HttpError, parseJson, route } from "../_lib/http";
import { compileBriefAndPlan } from "@/lib/prep";

export const GET = route(async () => NextResponse.json({ interviews: (await store.interviews.list()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) }));

export const POST = route(async (req) => {
  const { candidateId } = await parseJson(req, z.object({ candidateId: z.string().min(1) }));
  const candidate = await store.candidates.get(candidateId);
  if (!candidate) throw new HttpError(404, "Candidate not found");
  if (candidate.research === "pending" || candidate.research === "running") throw new HttpError(409, "Candidate background research is still running");
  const role = await store.roles.get(candidate.roleId);
  if (!role) throw new HttpError(404, "Role not found");
  if (!role.profile) throw new HttpError(409, "Role has no profile yet");
  const { brief, plan } = await compileBriefAndPlan({ role, candidate });
  const interview = await store.interviews.create({
    roleId: role.id,
    candidateId: candidate.id,
    mode: "room",
    meetUrl: null,
    recallBotId: null,
    status: "scheduled",
    brief,
    plan,
    startedAt: null,
    endedAt: null,
    recording: null,
    transcript: [],
    events: [],
    evidence: [],
    integrity: [],
    board: null,
    report: null,
  });
  return NextResponse.json({ interview }, { status: 201 });
});
