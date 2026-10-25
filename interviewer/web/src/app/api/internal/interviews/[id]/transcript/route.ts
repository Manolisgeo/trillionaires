import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";
import { type Ctx, HttpError, parseJson, requireInternal, route } from "../../../../_lib/http";

const Body = z.object({ segments: z.array(z.object({ id: z.string(), speaker: z.enum(["agent", "candidate"]), text: z.string(), start: z.number(), end: z.number() })).max(500) });

export const POST = route(async (req, { params }: Ctx) => {
  requireInternal(req);
  const { id } = await params;
  const body = await parseJson(req, Body);
  if (!(await store.interviews.get(id))) throw new HttpError(404, "Interview not found");
  await store.interviews.append(id, "transcript", body.segments);
  return NextResponse.json({ ok: true, appended: body.segments.length });
});
