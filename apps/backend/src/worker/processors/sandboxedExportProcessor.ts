import type { SandboxedJob } from "bullmq";
import type { EnqueuedJobData } from "../queues/index.js";
import { initializeDatabaseConnection } from "../../db/dbConnection.js";
import { initDb } from "../../db/database.js";
import { registerDefaultBackgroundJobRunners } from "../../services/backgroundJobRunnerService.js";
import { executeJob } from "../../services/backgroundJobWorkerService.js";
import { logger } from "../../lib/logger.js";
import { JOB_EXECUTION_TIMEOUT_MS } from "../queues/queueConfig.js";
import { settleInFlight } from "../../lib/backgroundJobAbort.js";

let initialized = false;
let initPromise: Promise<void> | null = null;

async function ensureWorkerSubprocessInitialized(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    process.env.TZ = "UTC";
    process.env.MMS_PROCESS_ROLE = "worker";
    initializeDatabaseConnection({ role: "worker", max: 5 });
    await initDb();
    registerDefaultBackgroundJobRunners();
    initialized = true;
  })();

  return initPromise;
}

/**
 * Sandboxed BullMQ processor for Bulk Export and Excel streaming tasks.
 * Runs in an isolated Node.js child process (useWorkerThreads: false)
 * with dedicated memory ceilings (--max-old-space-size=512) and 60s hard execution timeouts.
 */
export default async function sandboxedExportProcessor(
  job: SandboxedJob<EnqueuedJobData>,
): Promise<void> {
  await ensureWorkerSubprocessInitialized();

  const { tenantId, userId, jobId, moduleId, kind, payload } = job.data;
  logger.info(
    {
      jobId,
      moduleId,
      kind,
      pid: process.pid,
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024)),
    },
    "[SandboxedExportProcessor] Starting child export job",
  );

  const abortController = new AbortController();
  let timeoutHandle: NodeJS.Timeout | undefined;
  let timedOut = false;
  const executionPromise = executeJob(
    tenantId,
    userId,
    jobId,
    moduleId,
    kind,
    payload,
    abortController.signal,
  );
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true;
      abortController.abort();
      reject(
        new Error(
          `Bulk export job ${moduleId}:${kind} (${jobId}) exceeded ${JOB_EXECUTION_TIMEOUT_MS / 1000}s hard execution timeout`,
        ),
      );
    }, JOB_EXECUTION_TIMEOUT_MS);
  });

  try {
    await Promise.race([executionPromise, timeoutPromise]);

    logger.info(
      { jobId, moduleId, kind, pid: process.pid },
      "[SandboxedExportProcessor] Completed child export job successfully",
    );
  } catch (error) {
    // A timed-out runner may still be uploading. Wait for it to observe the
    // abort (up to five seconds) so BullMQ's retry cannot overlap it.
    if (timedOut || abortController.signal.aborted) {
      await settleInFlight(executionPromise, 5_000);
    }
    logger.error(
      { jobId, moduleId, kind, pid: process.pid, err: error },
      "[SandboxedExportProcessor] Child export job failed or timed out",
    );
    throw error;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}
