import { prisma } from "@kimma/database";
import { applyRetention } from "@/server/retention";

type JobInput = {
  type: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  organizationId?: string;
  maxAttempts?: number;
};

export async function enqueueJob(input: JobInput) {
  if (input.idempotencyKey) {
    const existing = await prisma.backgroundJob.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (existing && existing.status !== "DEAD") return existing;
    if (existing) {
      return prisma.backgroundJob.update({
        where: { id: existing.id },
        data: { status: "PENDING", runAt: new Date(), lastError: null, attempts: 0 },
      });
    }
  }

  return prisma.backgroundJob.create({
    data: {
      type: input.type,
      payload: JSON.parse(JSON.stringify(input.payload)),
      organizationId: input.organizationId,
      idempotencyKey: input.idempotencyKey,
      maxAttempts: input.maxAttempts ?? 5,
    },
  });
}

export async function processDueJobs(limit = 5): Promise<number> {
  const due = await prisma.backgroundJob.findMany({
    where: {
      status: { in: ["PENDING", "FAILED"] },
      runAt: { lte: new Date() },
    },
    orderBy: { runAt: "asc" },
    take: limit,
  });

  let ran = 0;
  for (const job of due) {
    const locked = await prisma.backgroundJob.updateMany({
      where: { id: job.id, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "RUNNING", attempts: { increment: 1 } },
    });
    if (locked.count === 0) continue;
    ran += 1;
    const attempts = job.attempts + 1;
    try {
      await dispatch(job.type, job.payload);
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: { status: "SUCCEEDED", lastError: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Job failed";
      const dead = attempts >= job.maxAttempts;
      const delayMs = Math.min(60_000, 1_000 * 2 ** attempts);
      await prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: dead ? "DEAD" : "FAILED",
          lastError: message,
          runAt: new Date(Date.now() + delayMs),
        },
      });
    }
  }
  return ran;
}

async function dispatch(type: string, payload: unknown) {
  const body = (payload ?? {}) as { conversationId?: string };
  if (type === "analysis.run") {
    if (!body.conversationId) throw new Error("analysis.run requires conversationId");
    const { runAnalysisPipeline } = await import("@/server/analysis");
    await runAnalysisPipeline(body.conversationId);
    return;
  }
  if (type === "retention.sweep") {
    await applyRetention();
    return;
  }
  throw new Error(`Unknown job type ${type}`);
}
