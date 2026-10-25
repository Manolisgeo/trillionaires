import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { createBot, recallConfigured } from "@/lib/recall";
import { store } from "@/lib/store";
import { type Ctx, HttpError, parseJson, route } from "../../../_lib/http";

const Body = z.object({ meetUrl: z.string().trim().url().refine((u) => /^https:\/\//i.test(u), "Meeting link must be https") });

export const POST = route(async (req, { params }: Ctx) => {
  const { id } = await params;
  const { meetUrl } = await parseJson(req, Body);
  if (!recallConfigured()) throw new HttpError(503, "Google Meet is unavailable: RECALL_API_KEY is not set. Add it to .env to send the interviewer to a meeting.");
  const interview = await store.interviews.get(id);
  if (!interview) throw new HttpError(404, "Interview not found");
  if (interview.status !== "scheduled") throw new HttpError(409, `Interview is already ${interview.status}`);
  const base = env("PUBLIC_BASE_URL").replace(/\/$/, "");
  let bot;
  try {
    bot = await createBot({
      meetingUrl: meetUrl,
      botPageUrl: `${base}/bot/${id}`,
      interviewId: id,
      joinMessage: `Hi, I'm Kimma, an AI interviewer. This call is recorded. Open the shared whiteboard: ${base}/room/${id}?view=board`,
    });
  } catch (e) {
    throw new HttpError(502, e instanceof Error ? e.message : "Recall request failed");
  }
  const updated = await store.interviews.update(id, { mode: "meet", meetUrl, recallBotId: bot.id });
  return NextResponse.json({ interview: updated, botId: bot.id }, { status: 201 });
});
