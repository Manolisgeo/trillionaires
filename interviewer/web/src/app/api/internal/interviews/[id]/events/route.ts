import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";
import { type Ctx, HttpError, parseJson, requireInternal, route } from "../../../../_lib/http";

const Body = z.object({ events: z.array(z.object({ seq: z.number(), t: z.number(), type: z.string(), payload: z.unknown() })).max(500) });

export const POST = route(async (req, { params }: Ctx) => {
  requireInternal(req);
  const { id } = await params;
  const body = await parseJson(req, Body);
  if (!(await store.interviews.get(id))) throw new HttpError(404, "Interview not found");
  await store.interviews.append(id, "events", body.events);
  return NextResponse.json({ ok: true, appended: body.events.length });
});
