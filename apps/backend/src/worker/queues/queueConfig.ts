import type { JobsOptions } from "bullmq";

export const QUEUE_PDF_RENDERING = "pdf-rendering";
export const QUEUE_BULK_EXPORT = "bulk-export";
export const QUEUE_MESSAGING_BROADCAST = "messaging-broadcast";
/** Long-running session rollover jobs get their own queue so CSV exports/imports cannot starve. */
export const QUEUE_SESSIONS_ROLLOVER = "sessions-rollover";

export interface QueueConcurrencyAndPriority {
  concurrency: number;
  priority: number;
}

export const QUEUE_SETTINGS: Record<string, QueueConcurrencyAndPriority> = {
  [QUEUE_PDF_RENDERING]: {
    concurrency: 4,
    priority: 1,
  },
  [QUEUE_BULK_EXPORT]: {
    concurrency: 2,
    priority: 2,
  },
  [QUEUE_MESSAGING_BROADCAST]: {
    concurrency: 6,
    priority: 3,
  },
  [QUEUE_SESSIONS_ROLLOVER]: {
    concurrency: 1,
    priority: 1,
  },
};

export { getBullMQConnectionOptions } from "../../lib/redis.js";
export { getQueuePrefix } from "../../lib/redisBullMQ.js";

export const WORKER_HEAP_LIMIT_BYTES =
  (Number(process.env.WORKER_HEAP_LIMIT_MB) || 512) * 1024 * 1024;

export const WORKER_SUBPROCESS_MEMORY_LIMIT_MB = 512;
export const JOB_EXECUTION_TIMEOUT_MS = 60_000;

/** Session rollover walks up to 5,000 students, one transaction per student. */
export const SESSIONS_ROLLOVER_TIMEOUT_MS =
  Number(process.env.SESSIONS_ROLLOVER_TIMEOUT_MS) || 15 * 60_000;
/** 500-row imports / large CSV exports need more than the sandboxed 60s ceiling. */
export const SESSIONS_IMPORT_TIMEOUT_MS =
  Number(process.env.SESSIONS_IMPORT_TIMEOUT_MS) || 10 * 60_000;
export const SESSIONS_EXPORT_TIMEOUT_MS =
  Number(process.env.SESSIONS_EXPORT_TIMEOUT_MS) || 10 * 60_000;

/**
 * A broadcast is `recipients × gateway latency`; bounding one attempt and
 * retrying is safe because the message-log claim is idempotent per recipient.
 */
export const MESSAGING_JOB_TIMEOUT_MS = 10 * 60_000;

/**
 * Force-exit ceiling for the worker's graceful shutdown.
 *
 * Messaging jobs are aborted immediately; sandboxed export/PDF children get
 * their full 60s processor budget to settle, plus 15s to close queues/Redis/DB.
 * PM2 kill_timeout is 90s so the process always exits before SIGKILL.
 */
export const WORKER_FORCE_EXIT_MS = JOB_EXECUTION_TIMEOUT_MS + 15_000;

/**
 * Per-job wall clock. Messaging batches get the longer budget; every other
 * queue keeps the 60s sandboxed-processor ceiling.
 */
export function resolveJobExecutionTimeoutMs(moduleId: string, kind: string): number {
  const normalizedModule = moduleId.trim().toLowerCase();
  const key = `${normalizedModule}:${kind.trim().toLowerCase()}`;
  const budgets: Record<string, number> = {
    "sessions:promote": SESSIONS_ROLLOVER_TIMEOUT_MS,
    "sessions:import": SESSIONS_IMPORT_TIMEOUT_MS,
    "sessions:export": SESSIONS_EXPORT_TIMEOUT_MS,
    "sessions:bulk-status": SESSIONS_IMPORT_TIMEOUT_MS,
    "sessions:bulk-archive": SESSIONS_IMPORT_TIMEOUT_MS,
  };
  if (budgets[key] !== undefined) return budgets[key];
  return normalizedModule === "messaging" ? MESSAGING_JOB_TIMEOUT_MS : JOB_EXECUTION_TIMEOUT_MS;
}

import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function resolveProcessorPath(processorBaseName: string): string {
  const dir = fileURLToPath(new URL("../processors", import.meta.url));
  const tsPath = join(dir, `${processorBaseName}.ts`);
  const jsPath = join(dir, `${processorBaseName}.js`);
  if (existsSync(tsPath)) return tsPath;
  if (existsSync(jsPath)) return jsPath;
  return jsPath;
}

export const SANDBOXED_PDF_PROCESSOR_PATH = resolveProcessorPath("sandboxedPdfProcessor");
export const SANDBOXED_EXPORT_PROCESSOR_PATH = resolveProcessorPath("sandboxedExportProcessor");

export const WORKER_FORK_OPTIONS = {
  execArgv: [
    ...process.execArgv.filter((arg) => !arg.startsWith("--max-old-space-size")),
    `--max-old-space-size=${WORKER_SUBPROCESS_MEMORY_LIMIT_MB}`,
  ],
};

export const TENANT_PRIORITY_BANDS = {
  BAND_1_LOW_LOAD: 1,
  BAND_2_NORMAL_LOAD: 2,
  BAND_3_HIGH_LOAD: 3,
} as const;

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 1000,
  },
  removeOnComplete: {
    count: 100,
    age: 3600, // 1 hour
  },
  removeOnFail: {
    count: 500,
    age: 86400, // 24 hours
  },
};
