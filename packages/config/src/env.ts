import { z } from "zod";

const optionalUrl = z.string().optional().default("");

export const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  APP_URL: z.string().default("http://localhost:3001"),
  AUTH_SECRET: z.string().min(16, "AUTH_SECRET must be at least 16 characters"),
  AUTH_URL: z.string().optional(),
  AGENT_INTERNAL_SECRET: z.string().min(16),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  LIVEKIT_URL: z.string().default("ws://localhost:7880"),
  LIVEKIT_API_KEY: z.string().default("devkey"),
  LIVEKIT_API_SECRET: z.string().default("secret"),
  LIVEKIT_AGENT_NAME: z.string().default("kimma-conversation-agent"),
  OPENAI_API_KEY: optionalUrl,
  OPENAI_REALTIME_MODEL: z.string().default("gpt-realtime"),
  OPENAI_ANALYSIS_MODEL: z.string().default("gpt-4.1"),
  OPENAI_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  S3_ENDPOINT: z.string().default("http://localhost:9000"),
  S3_ACCESS_KEY: z.string().default("minioadmin"),
  S3_SECRET_KEY: z.string().default("minioadmin"),
  S3_BUCKET: z.string().default("kimma-recordings"),
  S3_REGION: z.string().default("us-east-1"),
  S3_FORCE_PATH_STYLE: z.string().optional(),
  AVATAR_PROVIDER: z.string().optional().default(""),
  AVATAR_API_KEY: z.string().optional().default(""),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  cached = serverEnvSchema.parse(process.env);
  return cached;
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
