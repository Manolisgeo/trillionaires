import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { createToken, dispatchAgent, ensureRoom, identityFor, livekitConfigured, roomName } from "@/lib/livekit";
import { type Ctx, HttpError, loadInterview, parseJson, route } from "../../../_lib/http";

const Body = z.object({ as: z.enum(["candidate", "board", "bridge"]) });

export const POST = route(async (req, { params }: Ctx) => {
  const { id } = await params;
  const { as } = await parseJson(req, Body);
  if (!livekitConfigured()) throw new HttpError(503, "Voice unavailable: add LiveKit keys (or run `docker compose up livekit`).");
  const { interview, candidate } = await loadInterview(id);
  if (interview.status === "done" || interview.status === "processing") throw new HttpError(409, "This interview has ended");
  const room = roomName(id);
  try {
    await ensureRoom(room);
    // The board client never starts the agent; candidate (room mode) or bridge (meet mode) does.
    if (as !== "board") await dispatchAgent(room, { interviewId: id });
  } catch (e) {
    throw new HttpError(502, `Could not reach LiveKit: ${e instanceof Error ? e.message : String(e)}`);
  }
  const token = await createToken({
    identity: identityFor(as, id),
    name: as === "candidate" ? candidate.name : as === "board" ? `${candidate.name} (board)` : "Meeting bridge",
    room,
    canPublish: as !== "board",
    metadata: JSON.stringify({ interviewId: id, as }),
  });
  return NextResponse.json({ token, url: env("LIVEKIT_URL") });
});
