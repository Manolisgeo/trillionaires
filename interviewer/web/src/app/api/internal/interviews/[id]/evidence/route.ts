import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";
import { type Ctx, HttpError, parseJson, requireInternal, route } from "../../../../_lib/http";

const Body = z.object({ notes: z.array(z.object({ id: z.string(), t: z.number(), competencyId: z.string().nullable(), skillId: z.string().nullable(), note: z.string(), segmentId: z.string().nullable() })).max(500) });

export const POST = route(async (req, { params }: Ctx) => {
  requireInternal(req);
  const { id } = await params;
  const body = await parseJson(req, Body);
  if (!(await store.interviews.get(id))) throw new HttpError(404, "Interview not found");
  await store.interviews.append(id, "evidence", body.notes);
  return NextResponse.json({ ok: true, appended: body.notes.length });
});
