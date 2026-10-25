import { AccessToken, AgentDispatchClient, RoomServiceClient } from "livekit-server-sdk";
import { env, has } from "./env";

export type TokenRole = "candidate" | "board" | "bridge";

export const roomName = (interviewId: string): string => `interview-${interviewId}`;
export const identityFor = (role: TokenRole, interviewId: string): string => `${role}-${interviewId}`;

export function livekitConfigured(): boolean {
  return has("LIVEKIT_URL") && has("LIVEKIT_API_KEY") && has("LIVEKIT_API_SECRET");
}

function creds(): { url: string; key: string; secret: string } {
  const url = env("LIVEKIT_URL");
  const key = env("LIVEKIT_API_KEY");
  const secret = env("LIVEKIT_API_SECRET");
  if (!url || !key || !secret) {
    throw new Error("LiveKit is not configured: set LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET.");
  }
  return { url, key, secret };
}

// Server SDK clients speak HTTP(S); the client-facing URL stays ws(s).
const httpHost = (wsUrl: string): string => wsUrl.replace(/^ws(s?):\/\//, "http$1://");

export async function createToken(o: {
  identity: string;
  name: string;
  room: string;
  canPublish: boolean;
  metadata?: string;
}): Promise<string> {
  const { key, secret } = creds();
  const at = new AccessToken(key, secret, { identity: o.identity, name: o.name, metadata: o.metadata, ttl: "4h" });
  at.addGrant({
    roomJoin: true,
    room: o.room,
    canPublish: o.canPublish,
    canSubscribe: true,
    canPublishData: true, // text streams (board/pad/control) must work even for the non-publishing board client
  });
  return at.toJwt();
}

export async function ensureRoom(room: string): Promise<void> {
  const { url, key, secret } = creds();
  // createRoom returns the existing room when the name is taken.
  await new RoomServiceClient(httpHost(url), key, secret).createRoom({
    name: room,
    emptyTimeout: 15 * 60,
    departureTimeout: 5 * 60,
  });
}

/** Idempotent: does nothing when this agent is already dispatched to the room. */
export async function dispatchAgent(room: string, metadata: Record<string, unknown>): Promise<void> {
  const { url, key, secret } = creds();
  const agentName = env("LIVEKIT_AGENT_NAME");
  const client = new AgentDispatchClient(httpHost(url), key, secret);
  const existing = await client.listDispatch(room);
  if (existing.some((d) => d.agentName === agentName)) return;
  await client.createDispatch(room, agentName, { metadata: JSON.stringify(metadata) });
}
