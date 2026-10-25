import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getRecording, recallConfigured } from "@/lib/recall";
import { DATA_DIR, store } from "@/lib/store";
import { background, filesUrl, route } from "../../_lib/http";

interface Payload {
  event?: string;
  data?: { bot?: { id?: string; metadata?: { interviewId?: string } } };
}

/**
 * Recall status webhook (bot.done / recording.done). The body is never trusted for data: we only learn the bot id, then
 * re-fetch the recording from Recall with our key, so a forged call can at most trigger a re-download.
 */
export const POST = route(async (req) => {
  const body = (await req.json().catch(() => ({}))) as Payload;
  const event = body.event ?? "";
  const botId = body.data?.bot?.id;
  if (!botId || !["bot.done", "recording.done"].includes(event) || !recallConfigured()) return NextResponse.json({ ok: true, ignored: true });
  const interviews = await store.interviews.list();
  const iv = interviews.find((i) => i.recallBotId === botId) ?? interviews.find((i) => i.id === body.data?.bot?.metadata?.interviewId);
  if (!iv) return NextResponse.json({ ok: true, ignored: true });
  background("recall-recording", async () => {
    const rec = await getRecording(botId);
    if (!rec) return;
    const res = await fetch(rec.url); // presigned: no auth header
    if (!res.ok) throw new Error(`recording download failed (${res.status})`);
    await fs.mkdir(path.join(DATA_DIR, "recordings"), { recursive: true });
    await fs.writeFile(path.join(DATA_DIR, "recordings", `${iv.id}.mp4`), Buffer.from(await res.arrayBuffer()));
    const offsetSec = rec.startedAt && iv.startedAt ? (Date.parse(rec.startedAt) - Date.parse(iv.startedAt)) / 1000 : 0;
    await store.interviews.update(iv.id, { recording: { url: filesUrl(`recordings/${iv.id}.mp4`), offsetSec } });
  }, async (message) => {
    const cur = await store.interviews.get(iv.id);
    await store.interviews.append(iv.id, "events", [{ seq: cur?.events.length ?? 0, t: 0, type: "recording.error", payload: { message } }]);
  });
  return NextResponse.json({ ok: true });
});
