import { z } from "zod";

const flag = z.enum(["0", "1"]);
const schema = z.object({
  PUBLIC_BASE_URL: z.string().default("http://localhost:3000"),
  AGENT_INTERNAL_SECRET: z.string().optional(),
  LIVEKIT_URL: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  LIVEKIT_AGENT_NAME: z.string().default("kimma-interviewer"),
  ANTHROPIC_API_KEY: z.string().optional(),
  PREP_MODEL: z.string().default("claude-sonnet-5-5"),
  SCORER_MODEL: z.string().default("claude-opus-5-5"),
  VOICE_MODE: z.enum(["cascade", "openai_realtime"]).default("cascade"),
  INTERVIEWER_LLM: z.string().default("openai:gpt-4.1-mini"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_REALTIME_MODEL: z.string().default("gpt-realtime"),
  DEEPGRAM_API_KEY: z.string().optional(),
  DEEPGRAM_MODEL: z.string().default("nova-3"),
  TTS_PROVIDER: z.enum(["cartesia", "elevenlabs", "openai"]).default("cartesia"),
  CARTESIA_API_KEY: z.string().optional(),
  CARTESIA_VOICE_ID: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  BROWSERBASE_API_KEY: z.string().optional(),
  BROWSERBASE_PROJECT_ID: z.string().optional(),
  EXA_API_KEY: z.string().optional(),
  GITHUB_TOKEN: z.string().optional(),
  RECALL_API_KEY: z.string().optional(),
  RECALL_REGION: z.string().default("us-west-2"),
  DEMO_SHORT_INTERVIEW: flag.default("0"),
});

export type Env = z.infer<typeof schema>;
export type EnvKey = keyof Env;

let cached: Env | null = null;

// Lazy, never throws: empty strings count as unset; invalid values fall back to the key's default.
function parse(): Env {
  if (cached) return cached;
  const raw: Record<string, string | undefined> = {};
  for (const key of Object.keys(schema.shape)) {
    const v = process.env[key];
    if (v !== undefined && v.trim() !== "") raw[key] = v.trim();
  }
  const res = schema.safeParse(raw);
  if (res.success) {
    cached = res.data;
  } else {
    const bad = new Set(res.error.issues.map((i) => String(i.path[0])));
    for (const k of bad) delete raw[k];
    cached = schema.parse(raw);
    console.warn(`[env] invalid values ignored, using defaults: ${[...bad].join(", ")}`);
  }
  return cached;
}

export function env<K extends EnvKey>(key: K): Env[K] {
  return parse()[key];
}

export function has(key: EnvKey): boolean {
  const v = parse()[key];
  return v !== undefined && v !== "";
}
