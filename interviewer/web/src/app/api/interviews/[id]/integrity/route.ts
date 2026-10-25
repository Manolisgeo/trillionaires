import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";
import { type Ctx, HttpError, parseJson, route } from "../../../_lib/http";

const IntegritySchema = z.object({
  t: z.number().min(0),
  kind: z.enum(["tab_hidden", "paste", "rejoin", "long_silence"]),
  detail: z.string().max(500).optional(),
});

export const POST = route(async (req, { params }: Ctx) => {
  const { id } = await params;
  const { signal } = await parseJson(req, z.object({ signal: IntegritySchema }));
  if (!(await store.interviews.get(id))) throw new HttpError(404, "Interview not found");
  await store.interviews.append(id, "integrity", [signal]);
  return NextResponse.json({ ok: true });
});
