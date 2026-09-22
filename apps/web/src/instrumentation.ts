export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { config: loadEnv } = await import("dotenv");
  const { resolve } = await import("node:path");
  loadEnv({ path: resolve(process.cwd(), ".env") });
  loadEnv({ path: resolve(process.cwd(), "../../.env") });

  const { getServerEnv } = await import("@aperture/config");
  getServerEnv();

  try {
    const { enqueueJob, processDueJobs } = await import("@/server/jobs");
    const day = new Date().toISOString().slice(0, 10);
    await enqueueJob({
      type: "retention.sweep",
      idempotencyKey: `retention:${day}`,
      payload: {},
    });
    await processDueJobs(3);
  } catch (error) {
    console.error("Background job kickoff failed", error);
  }
}
