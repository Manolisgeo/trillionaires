import { env, has } from "./env";

export class RecallUnavailableError extends Error {
  constructor() {
    super("Google Meet is unavailable: RECALL_API_KEY is not set. Add it to .env to send the interviewer to a meeting.");
  }
}

export const recallConfigured = (): boolean => has("RECALL_API_KEY");

const base = (): string => `https://${env("RECALL_REGION")}.recall.ai/api/v1`;

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const key = env("RECALL_API_KEY");
  if (!key) throw new RecallUnavailableError();
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: { Authorization: `Token ${key}`, "content-type": "application/json", accept: "application/json", ...init.headers },
  });
  if (!res.ok) throw new Error(`Recall ${init.method ?? "GET"} ${path} failed (${res.status}): ${(await res.text()).slice(0, 400)}`);
  return (await res.json()) as T;
}

export interface RecallBot {
  id: string;
  status_changes?: { code: string }[];
  recordings?: {
    id: string;
    started_at: string | null;
    completed_at: string | null;
    status?: { code: string };
    media_shortcuts?: { video_mixed?: { data?: { download_url: string | null } | null } | null; audio_mixed?: { data?: { download_url: string | null } | null } | null } | null;
  }[];
}

/**
 * Create a bot whose camera is the bridge page. Fields verified against docs.recall.ai (2026-10): output_media.camera
 * {kind:"webpage", config:{url}}, variant.{google_meet|zoom|microsoft_teams} "web_4_core", recording_config.video_mixed_mp4,
 * chat.on_bot_join {send_to, message, pin}, metadata. The `Token` auth prefix is optional per the docs.
 */
export async function createBot(o: { meetingUrl: string; botPageUrl: string; interviewId: string; joinMessage: string }): Promise<RecallBot> {
  return call<RecallBot>("/bot/", {
    method: "POST",
    body: JSON.stringify({
      meeting_url: o.meetingUrl,
      bot_name: "Aperture (AI interviewer)",
      output_media: { camera: { kind: "webpage", config: { url: o.botPageUrl } } },
      variant: { google_meet: "web_4_core", zoom: "web_4_core", microsoft_teams: "web_4_core" },
      recording_config: { video_mixed_mp4: {}, retention: { type: "timed", hours: 168 } },
      chat: { on_bot_join: { send_to: "everyone", message: o.joinMessage.slice(0, 480), pin: true } },
      metadata: { interviewId: o.interviewId },
    }),
  });
}

/** Meet allows 500 chars; pin is Meet-only and ignored elsewhere. */
export async function sendChatMessage(botId: string, message: string, pin = false): Promise<void> {
  await call(`/bot/${encodeURIComponent(botId)}/send_chat_message/`, {
    method: "POST",
    body: JSON.stringify({ to: "everyone", message: message.slice(0, 480), pin }),
  });
}

export const getBot = (botId: string): Promise<RecallBot> => call<RecallBot>(`/bot/${encodeURIComponent(botId)}/`);

/** Presigned mp4 URL (fetch without auth header) of the first finished recording, plus its start time. */
export async function getRecording(botId: string): Promise<{ url: string; startedAt: string | null } | null> {
  const bot = await getBot(botId);
  for (const r of bot.recordings ?? []) {
    const url = r.media_shortcuts?.video_mixed?.data?.download_url;
    if (url) return { url, startedAt: r.started_at };
  }
  return null;
}
