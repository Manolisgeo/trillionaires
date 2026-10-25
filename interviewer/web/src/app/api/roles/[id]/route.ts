import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";
import type { RoleProfile } from "@/lib/types";
import { type Ctx, HttpError, parseJson, route } from "../../_lib/http";

const Anchor = z.object({ weak: z.string(), ok: z.string(), strong: z.string() });
const Skill = z.object({ id: z.string(), name: z.string(), weight: z.number(), evidenceHints: z.array(z.string()) });
const Profile: z.ZodType<RoleProfile> = z.object({
  summary: z.string(),
  level: z.string(),
  mustHave: z.array(Skill),
  niceToHave: z.array(Skill),
  competencies: z.array(z.object({ id: z.string(), name: z.string(), description: z.string(), weight: z.number(), anchors: Anchor })),
  coreQuestions: z.array(z.object({ id: z.string(), competencyId: z.string(), text: z.string(), followUps: z.array(z.string()) })),
  technicalTopics: z.array(z.object({ id: z.string(), name: z.string(), difficulty: z.enum(["junior", "mid", "senior"]), probes: z.array(z.string()) })),
  problems: z.array(z.object({ id: z.string(), title: z.string(), prompt: z.string(), goodAnswerLooksLike: z.string(), constraintChanges: z.array(z.string()) })),
  guardrailNotes: z.array(z.string()),
});
const Patch = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  company: z.string().trim().min(1).max(200).optional(),
  profile: Profile.optional(),
});

export const GET = route(async (_req, { params }: Ctx) => {
  const role = await store.roles.get((await params).id);
  if (!role) throw new HttpError(404, "Role not found");
  return NextResponse.json({ role });
});

export const PATCH = route(async (req, { params }: Ctx) => {
  const { id } = await params;
  const patch = await parseJson(req, Patch);
  const role = await store.roles.get(id);
  if (!role) throw new HttpError(404, "Role not found");
  if (patch.profile && role.status === "drafting") throw new HttpError(409, "The profile is still being drafted");
  // Editing an approved profile sends it back to draft so the recruiter re-approves.
  const status = patch.profile && role.status === "approved" ? "draft" : role.status;
  return NextResponse.json({ role: await store.roles.update(id, { ...patch, status }) });
});
