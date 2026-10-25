import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";
import { type Ctx, HttpError, parseJson, route } from "../../_lib/http";

const Patch = z.object({
  removeClaimIds: z.array(z.string()).optional(),
  restoreClaimIds: z.array(z.string()).optional(),
  corrections: z.array(z.object({ claimId: z.string(), text: z.string().trim().min(1).max(2000) })).optional(),
  reviewed: z.boolean().optional(),
});

export const GET = route(async (_req, { params }: Ctx) => {
  const c = await store.candidates.get((await params).id);
  if (!c) throw new HttpError(404, "Candidate not found");
  return NextResponse.json({ candidate: c, research: c.research, researchError: c.researchError ?? null, profile: c.profile });
});

export const PATCH = route(async (req, { params }: Ctx) => {
  const { id } = await params;
  const patch = await parseJson(req, Patch);
  const c = await store.candidates.get(id);
  if (!c) throw new HttpError(404, "Candidate not found");
  if (!c.profile) throw new HttpError(409, "The background summary is not ready yet");
  const remove = new Set(patch.removeClaimIds ?? []);
  const restore = new Set(patch.restoreClaimIds ?? []);
  const fix = new Map((patch.corrections ?? []).map((x) => [x.claimId, x.text]));
  const claims = c.profile.claims.map((cl) => ({
    ...cl,
    text: fix.get(cl.id) ?? cl.text,
    removedByCandidate: remove.has(cl.id) ? true : restore.has(cl.id) ? false : cl.removedByCandidate,
  }));
  const candidate = await store.candidates.update(id, {
    profile: { ...c.profile, claims },
    ...(patch.reviewed ? { reviewedAt: new Date().toISOString() } : {}),
  });
  return NextResponse.json({ candidate });
});
