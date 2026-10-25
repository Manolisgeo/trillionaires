import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { type Ctx, HttpError, requireInternal, route } from "../../../../_lib/http";

export const POST = route(async (req, { params }: Ctx) => {
  requireInternal(req);
  const { id } = await params;
  const iv = await store.interviews.get(id);
  if (!iv) throw new HttpError(404, "Interview not found");
  // Idempotent: a reconnecting agent keeps the original clock.
  if (iv.startedAt && iv.status === "live") return NextResponse.json({ startedAt: iv.startedAt });
  if (iv.status === "processing" || iv.status === "done") throw new HttpError(409, "Interview already ended");
  const startedAt = new Date().toISOString();
  await store.interviews.update(id, { startedAt, status: "live" });
  return NextResponse.json({ startedAt });
});
