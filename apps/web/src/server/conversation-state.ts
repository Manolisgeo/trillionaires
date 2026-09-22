import type { ConversationState } from "@aperture/types";
import { getRedis } from "@/server/redis";

const TTL_SECONDS = 60 * 60 * 24;

function key(conversationId: string): string {
  return `conversation:state:${conversationId}`;
}

export async function readConversationState(
  conversationId: string,
): Promise<ConversationState | null> {
  try {
    const raw = await getRedis().get(key(conversationId));
    if (!raw) return null;
    return JSON.parse(raw) as ConversationState;
  } catch {
    return null;
  }
}

export async function writeConversationState(state: ConversationState): Promise<void> {
  try {
    await getRedis().set(key(state.conversationId), JSON.stringify(state), "EX", TTL_SECONDS);
  } catch {
    // Redis is best-effort for hot state; durable events still land in Postgres.
  }
}
