/**
 * Ops replay for a dead-lettered background job.
 *
 * Usage: tsx src/scripts/replay_dead_letter_job.ts <tenant> <jobId>
 *
 * Re-enqueues the persisted payload with a fresh attempt budget. Domain-specific recovery
 * (e.g. a session rollover resuming the same run) is handled by the runner's idempotency keys.
 */
import { loadBackendEnv } from "../config/loadEnv.js";
import { initDb, closeDatabase } from "../db/database.js";
import { withTenant } from "../db/tenant-context.js";
import { backgroundJobs } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { patchJob } from "../services/backgroundJobPatch.js";
import { rowToJobRecord } from "../services/backgroundJobService.js";
import { dispatchJobToQueue } from "../worker/queues/index.js";
import { resumePromotionRunForReplay } from "../services/sessionRolloverFinalizer.js";

async function main(): Promise<void> {
  loadBackendEnv();
  const [tenant, jobId] = process.argv.slice(2);
  if (!tenant || !jobId) throw new Error("Usage: replay_dead_letter_job <tenant> <jobId>");
  await initDb();
  const row = await withTenant(tenant, async (tx) => {
    const [found] = await tx
      .select({
        id: backgroundJobs.id,
        tenantId: backgroundJobs.tenantId,
        userId: backgroundJobs.userId,
        moduleId: backgroundJobs.moduleId,
        kind: backgroundJobs.kind,
        status: backgroundJobs.status,
        label: backgroundJobs.label,
        payload: backgroundJobs.payload,
        progressCurrent: backgroundJobs.progressCurrent,
        progressTotal: backgroundJobs.progressTotal,
        artifactId: backgroundJobs.artifactId,
        hasDownload: backgroundJobs.hasDownload,
        error: backgroundJobs.error,
        deadLetteredAt: backgroundJobs.deadLetteredAt,
        completedAt: backgroundJobs.completedAt,
        createdAt: backgroundJobs.createdAt,
        updatedAt: backgroundJobs.updatedAt,
      })
      .from(backgroundJobs)
      .where(eq(backgroundJobs.id, jobId))
      .limit(1);
    return found ?? null;
  });
  if (!row) throw new Error(`Background job ${jobId} not found for tenant ${tenant}`);
  if (!row.deadLetteredAt) throw new Error(`Background job ${jobId} is not dead-lettered`);
  if (row.moduleId === "sessions" && row.kind === "promote") {
    const resumed = await resumePromotionRunForReplay(tenant, jobId, row.userId);
    if (!resumed)
      throw new Error(`Rollover run ${jobId} is not in a failed state; refusing to replay`);
  }
  await patchJob(tenant, row.userId, jobId, {
    status: "pending",
    error: null,
    completedAt: null,
    deadLetteredAt: null,
  });
  const dispatched = await dispatchJobToQueue(
    tenant,
    row.userId,
    rowToJobRecord({ ...row, deadLetteredAt: null }),
    row.payload,
  );
  if (!dispatched)
    throw new Error("Queue is unavailable; the job remains pending and can be replayed later");
  console.log(`Replayed dead-lettered job ${jobId}`);
  await closeDatabase();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
