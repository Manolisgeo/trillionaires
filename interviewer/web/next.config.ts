import path from "node:path";
import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";

// One .env at interviewer/.env, shared with the Python agent.
loadEnvConfig(path.resolve(process.cwd(), ".."));

const nextConfig: NextConfig = {
  serverExternalPackages: ["livekit-server-sdk"],
  // Candidate CVs / recordings are served through /api/files, never statically.
  outputFileTracingRoot: path.resolve(process.cwd(), ".."),
};

export default nextConfig;
