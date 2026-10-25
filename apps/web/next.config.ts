import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import type { NextConfig } from "next";

loadEnv({ path: resolve(__dirname, "../../.env") });
loadEnv({ path: resolve(__dirname, "../../.env.local") });

const nextConfig: NextConfig = {
  transpilePackages: [
    "@kimma/ai",
    "@kimma/config",
    "@kimma/conversation",
    "@kimma/database",
    "@kimma/intelligence",
    "@kimma/types",
    "@kimma/ui",
  ],
  serverExternalPackages: ["@prisma/client", "ioredis", "bcryptjs"],
};

export default nextConfig;
