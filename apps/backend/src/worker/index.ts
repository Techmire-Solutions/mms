import { Worker } from "bullmq";
import { initDb, closeDatabase } from "../db/database.js";
import { activeDb, initializeDatabaseConnection } from "../db/dbConnection.js";
import { disconnectRedis } from "../lib/redis.js";
import { loadBackendEnv } from "../config/loadEnv.js";

loadBackendEnv();
import {
  QUEUE_PDF_RENDERING,
  QUEUE_BULK_EXPORT,
  QUEUE_MESSAGING_BROADCAST,
  QUEUE_SETTINGS,
  getBullMQConnectionOptions,
  getQueuePrefix,
  closeAllQueues,
  handleDeadLetterJob,
  decrementTenantInflightJobs,
  type EnqueuedJobData,
} from "./queues/index.js";
import {
  SANDBOXED_PDF_PROCESSOR_PATH,
  SANDBOXED_EXPORT_PROCESSOR_PATH,
  WORKER_FORK_OPTIONS,
  WORKER_FORCE_EXIT_MS,
} from "./queues/queueConfig.js";
import { processBackgroundJob } from "./processors/jobProcessor.js";
import { registerDefaultBackgroundJobRunners } from "../services/backgroundJobRunnerService.js";
import { abortBackgroundJobsOnShutdown } from "../services/backgroundJobDeadline.js";
import { logger } from "../lib/logger.js";
import { defaultSearchAdapter } from "./adapters/searchIndexAdapter.js";
import { purgeExpiredArchivedRecords } from "./purgeArchivedRecordsJob.js";
import { purgeExpiredPlatformActivityLogs } from "./purgePlatformActivityLogsJob.js";
import { clearRetentionPurgeScheduler, scheduleNextDailyPurge } from "./retentionPurgeScheduler.js";
import {
  clearSessionLifecycleScheduler,
  scheduleSessionLifecycle,
} from "./sessionLifecycleScheduler.js";
import { clearFxRateFeedScheduler, scheduleFxRateFeed } from "./fxRates/fxRateFeedScheduler.js";
import { startOutboxCdcListener, type OutboxCdcHandle } from "./outboxCdcListener.js";
import { cleanupOrphanedJobs } from "./workerOrphanCleanup.js";

export { getMsUntilNextUtcHour, runRetentionPurgeCycle } from "./retentionPurgeScheduler.js";

export { cleanupOrphanedJobs };

let isRunning = true;
const activeWorkers: Worker<EnqueuedJobData>[] = [];
/** Handle for the event-driven outbox CDC listener — closed on shutdown. */
let cdcListenerHandle: OutboxCdcHandle | null = null;

export function createWorkerForQueue(queueName: string): Worker<EnqueuedJobData> {
  const connection = getBullMQConnectionOptions();
  const prefix = getQueuePrefix();
  const concurrency = QUEUE_SETTINGS[queueName]?.concurrency ?? 2;

  let worker: Worker<EnqueuedJobData>;

  if (queueName === QUEUE_PDF_RENDERING) {
    worker = new Worker<EnqueuedJobData>(queueName, SANDBOXED_PDF_PROCESSOR_PATH, {
      connection,
      prefix,
      concurrency,
      useWorkerThreads: false,
      workerForkOptions: WORKER_FORK_OPTIONS,
      lockDuration: 60000,
    });
  } else if (queueName === QUEUE_BULK_EXPORT) {
    worker = new Worker<EnqueuedJobData>(queueName, SANDBOXED_EXPORT_PROCESSOR_PATH, {
      connection,
      prefix,
      concurrency,
      useWorkerThreads: false,
      workerForkOptions: WORKER_FORK_OPTIONS,
      lockDuration: 60000,
    });
  } else {
    worker = new Worker<EnqueuedJobData>(
      queueName,
      async (job) => {
        // Heap backpressure sentinel: check memory usage before running heavy background jobs
        const mem = process.memoryUsage();
        if (mem.heapUsed > 0.85 * mem.heapTotal && mem.heapUsed > 256 * 1024 * 1024) {
          logger.warn(
            { queue: queueName, jobId: job.id, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
            "Worker memory backpressure threshold exceeded; pausing briefly to allow GC",
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
        await processBackgroundJob(job);
      },
      {
        connection,
        prefix,
        concurrency,
        lockDuration: 60000,
      },
    );
  }

  worker.on("completed", (job) => {
    logger.info({ jobId: job.id, queue: queueName }, "Job completed");
    if (job?.data?.tenantId) {
      void decrementTenantInflightJobs(job.data.tenantId).catch(() => {});
    }
  });

  worker.on("failed", (job, err) => {
    logger.error({ jobId: job?.id, queue: queueName, err: err.message }, "Job failed");
    // Fair-share counts one slot per dispatched job. Decrement only when the
    // job will not be retried, otherwise a retrying tenant looks idle and is
    // promoted into the highest-priority band.
    const finalAttempt = (job?.attemptsMade ?? 0) >= (job?.opts.attempts ?? 1);
    if (job?.data?.tenantId && finalAttempt) {
      void decrementTenantInflightJobs(job.data.tenantId).catch(() => {});
    }
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
      void handleDeadLetterJob(queueName, job.data, err.message).catch((deadLetterErr) => {
        logger.error({ jobId: job.id, err: deadLetterErr }, "Dead-letter handling failed");
      });
    }
  });

  worker.on("error", (err) => {
    logger.error({ queue: queueName, err }, "Worker error");
  });

  return worker;
}

export async function startWorkerDaemon(): Promise<void> {
  logger.info("Initializing Worker Daemon...");
  process.env.TZ = "UTC";
  process.env.MMS_PROCESS_ROLE = "worker";

  // Explicitly initialize dedicated worker connection pool (budgeted to max: 10)
  initializeDatabaseConnection({ role: "worker", max: 10 });
  await initDb();
  await cleanupOrphanedJobs();

  // Register job runners
  registerDefaultBackgroundJobRunners();

  // Instantiate workers for all 3 queues
  const queueNames = [QUEUE_PDF_RENDERING, QUEUE_BULK_EXPORT, QUEUE_MESSAGING_BROADCAST];
  for (const queueName of queueNames) {
    try {
      const worker = createWorkerForQueue(queueName);
      activeWorkers.push(worker);
      logger.info(
        { queue: queueName, concurrency: QUEUE_SETTINGS[queueName]?.concurrency },
        "Started worker",
      );
    } catch (err) {
      logger.error({ queue: queueName, err }, "Failed to start worker");
    }
  }

  logger.info("All workers started and listening.");

  // Start the event-driven CDC outbox listener (with 30s fallback poll)
  cdcListenerHandle = await startOutboxCdcListener(defaultSearchAdapter, {
    fallbackPollIntervalMs: 30_000,
  });

  // Register the daily retention purge schedule to run at 02:00 UTC
  scheduleNextDailyPurge(() => isRunning, activeDb(), 2);
  // Hourly: open sessions auto-start on their start date (workspace timezone).
  scheduleSessionLifecycle(() => isRunning);
  // Daily IAS 21 reference rates (no-op unless FX_RATE_FEED_PROVIDERS is set)
  scheduleFxRateFeed(() => isRunning);

  const shutdown = async (signal: string) => {
    if (!isRunning) return;
    logger.info({ signal }, "Received signal, shutting down...");
    isRunning = false;

    process.removeAllListeners("SIGTERM");
    process.removeAllListeners("SIGINT");

    // Abort in-flight runners first: messaging batches can run for minutes and
    // `pause()` would otherwise wait for them, racing PM2's kill_timeout.
    // Exports/PDF settle through the same deadline path (5s grace).
    const shutdownBudgetMs = WORKER_FORCE_EXIT_MS;
    const forceExitTimer = setTimeout(() => {
      logger.fatal("Graceful shutdown timed out; forcing exit");
      process.exit(1);
    }, shutdownBudgetMs);
    forceExitTimer.unref?.();

    try {
      if (cdcListenerHandle !== null) {
        await cdcListenerHandle.stop();
        cdcListenerHandle = null;
      }
      clearRetentionPurgeScheduler();
      clearSessionLifecycleScheduler();
      clearFxRateFeedScheduler();

      abortBackgroundJobsOnShutdown("SIGTERM");
      // Stop accepting new jobs without waiting for the now-aborting active ones.
      for (const worker of activeWorkers) {
        try {
          await worker.pause(true);
        } catch (err) {
          logger.error({ err }, "Error pausing worker");
        }
      }
      for (const worker of activeWorkers) {
        try {
          await worker.close();
        } catch (err) {
          logger.error({ err }, "Error closing worker");
        }
      }
      await closeAllQueues();
      await disconnectRedis();
      await closeDatabase();
      logger.info("Gracefully shut down.");
      if (process.env.NODE_ENV !== "test") process.exit(0);
    } catch (err) {
      logger.error({ err }, "Shutdown failed");
      if (process.env.NODE_ENV !== "test") process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    logger.fatal({ reason }, "Unhandled rejection");
    void shutdown("unhandledRejection");
  });
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Uncaught exception");
    void shutdown("uncaughtException");
  });
}

export { activeWorkers, purgeExpiredArchivedRecords, purgeExpiredPlatformActivityLogs };

const isWorkerMain =
  process.env.NODE_ENV !== "test" &&
  !process.env.VITEST &&
  (Boolean(process.env.pm_id || process.env.pm_exec_path) ||
    import.meta.url === `file://${process.argv[1]}` ||
    Boolean(
      process.argv[1]?.endsWith("worker/index.js") || process.argv[1]?.endsWith("worker/index.ts"),
    ));

if (isWorkerMain) {
  startWorkerDaemon().catch((error) => {
    logger.fatal({ err: error }, "Fatal startup error");
    process.exit(1);
  });
}
