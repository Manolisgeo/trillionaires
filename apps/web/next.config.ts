import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import type { NextConfig } from "next";

loadEnv({ path: resolve(__dirname, "../../.env") });
loadEnv({ path: resolve(__dirname, "../../.env.local") });

const nextConfig: NextConfig = {
  transpilePackages: [
    "@aperture/ai",
    "@aperture/config",
    "@aperture/conversation",
    "@aperture/database",
    "@aperture/intelligence",
    "@aperture/types",
    "@aperture/ui",
  ],
  serverExternalPackages: ["@prisma/client", "ioredis", "bcryptjs"],
};

export default nextConfig;
