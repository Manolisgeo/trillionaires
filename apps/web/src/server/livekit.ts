import {
  AccessToken,
  AgentDispatchClient,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  RoomServiceClient,
  S3Upload,
  type VideoGrant,
} from "livekit-server-sdk";

function livekitHttpUrl(wsUrl: string): string {
  return wsUrl.replace(/^ws:/, "http:").replace(/^wss:/, "https:");
}

export function livekitEnv() {
  return {
    url: process.env.LIVEKIT_URL ?? "ws://localhost:7880",
    apiKey: process.env.LIVEKIT_API_KEY ?? "devkey",
    apiSecret: process.env.LIVEKIT_API_SECRET ?? "secret",
    agentName: process.env.LIVEKIT_AGENT_NAME ?? "aperture-conversation-agent",
  };
}

export async function createParticipantToken(input: {
  identity: string;
  name: string;
  roomName: string;
  metadata?: string;
  canPublish?: boolean;
}): Promise<string> {
  const env = livekitEnv();
  const token = new AccessToken(env.apiKey, env.apiSecret, {
    identity: input.identity,
    name: input.name,
    metadata: input.metadata,
    ttl: "2h",
  });
  const grant: VideoGrant = {
    room: input.roomName,
    roomJoin: true,
    canPublish: input.canPublish ?? true,
    canSubscribe: true,
    canPublishData: true,
  };
  token.addGrant(grant);
  Object.assign(token, {
    roomConfig: { agents: [{ agentName: env.agentName }] },
  });
  return token.toJwt();
}

export async function ensureRoom(roomName: string, metadata: string): Promise<void> {
  const env = livekitEnv();
  const rooms = new RoomServiceClient(livekitHttpUrl(env.url), env.apiKey, env.apiSecret);
  try {
    await rooms.createRoom({
      name: roomName,
      metadata,
      emptyTimeout: 60 * 30,
      maxParticipants: 12,
    });
  } catch {
    // already exists
  }
}

export async function dispatchAgent(roomName: string, metadata: string): Promise<void> {
  const env = livekitEnv();
  try {
    const dispatch = new AgentDispatchClient(livekitHttpUrl(env.url), env.apiKey, env.apiSecret);
    await dispatch.createDispatch(roomName, env.agentName, { metadata });
  } catch (error) {
    console.warn("Agent dispatch skipped (worker will join by room name if running):", error);
  }
}

export async function startRoomRecording(input: {
  roomName: string;
  objectKey: string;
}): Promise<string | null> {
  const env = livekitEnv();
  const endpoint = process.env.S3_ENDPOINT;
  const access = process.env.S3_ACCESS_KEY;
  const secret = process.env.S3_SECRET_KEY;
  const bucket = process.env.S3_BUCKET;
  if (!endpoint || !access || !secret || !bucket) return null;

  try {
    const egress = new EgressClient(livekitHttpUrl(env.url), env.apiKey, env.apiSecret);
    const info = await egress.startRoomCompositeEgress(input.roomName, {
      file: new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath: input.objectKey,
        output: {
          case: "s3",
          value: new S3Upload({
            accessKey: access,
            secret: secret,
            bucket,
            endpoint,
            region: process.env.S3_REGION ?? "us-east-1",
            forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
          }),
        },
      }),
    });
    return info.egressId ?? null;
  } catch (error) {
    console.warn("LiveKit egress not available; transcript-only recording.", error);
    return null;
  }
}
