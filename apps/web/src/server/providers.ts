import type { AvatarProvider, MeetingProvider, TelephonyProvider } from "@aperture/types";

/** Native LiveKit is the only meeting implementation in the MVP. */
export const livekitMeetingProvider: MeetingProvider = {
  async createMeeting(input) {
    return { provider: "livekit", meetingId: input.conversationId, roomName: input.conversationId };
  },
  async joinMeeting() {
    throw new Error("Use /api/livekit/token");
  },
  async leaveMeeting() {},
};

export const unimplementedAvatarProvider: AvatarProvider = {
  async createSession() {
    throw new Error("Avatar providers are not enabled in the MVP. Latency first.");
  },
  async connect() {},
  async disconnect() {},
};

export const unimplementedTelephonyProvider: TelephonyProvider = {
  async startInboundCall() {
    throw new Error("Telephony is designed via LiveKit SIP and is not in the MVP.");
  },
  async startOutboundCall() {
    throw new Error("Telephony is designed via LiveKit SIP and is not in the MVP.");
  },
  async hangup() {},
};
