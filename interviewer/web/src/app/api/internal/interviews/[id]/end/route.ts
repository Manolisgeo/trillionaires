import { NextResponse } from "next/server";
import { z } from "zod";
import { store } from "@/lib/store";
import { background, type Ctx, HttpError, loadInterview, parseJson, requireInternal, route } from "../../../../_lib/http";
import { scoreInterview } from "@/lib/scoring";

const Body = z.object({ reason: z.string().max(200).default("ended") });

export const POST = route(async (req, { params }: Ctx) => {
  requireInternal(req);
  const { id } = await params;
  const { reason } = await parseJson(req, Body);
  const iv = await store.interviews.get(id);
  if (!iv) throw new HttpError(404, "Interview not found");
  // Idempotent: the agent may call end twice (tool + disconnect).
  if (iv.status === "processing" || iv.status === "done") return NextResponse.json({ status: iv.status });
  await store.interviews.update(id, { status: "processing", endedAt: new Date().toISOString() });
  await store.interviews.append(id, "events", [{ seq: iv.events.length, t: iv.startedAt ? (Date.now() - Date.parse(iv.startedAt)) / 1000 : 0, type: "ended", payload: { reason } }]);

  background("scoring", async () => {
    await new Promise((r) => setTimeout(r, 1500)); // let the agent's last transcript batch land
    const fresh = await loadInterview(id);
    const report = await scoreInterview({ interview: fresh.interview, role: fresh.role, candidate: fresh.candidate });
    await store.interviews.update(id, { report, status: "done" });
  }, async (message) => {
    await store.interviews.update(id, { status: "failed" });
    const cur = await store.interviews.get(id);
    await store.interviews.append(id, "events", [{ seq: cur?.events.length ?? 0, t: 0, type: "scoring.error", payload: { message } }]);
  });
  return NextResponse.json({ status: "processing" });
});
