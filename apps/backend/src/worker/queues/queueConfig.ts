import type { JobsOptions } from "bullmq";

export const QUEUE_PDF_RENDERING = "pdf-rendering";
export const QUEUE_BULK_EXPORT = "bulk-export";
export const QUEUE_MESSAGING_BROADCAST = "messaging-broadcast";

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
};

export { getBullMQConnectionOptions } from "../../lib/redis.js";
export { getQueuePrefix } from "../../lib/redisBullMQ.js";

export const WORKER_HEAP_LIMIT_BYTES =
  (Number(process.env.WORKER_HEAP_LIMIT_MB) || 512) * 1024 * 1024;

export const WORKER_SUBPROCESS_MEMORY_LIMIT_MB = 512;
export const JOB_EXECUTION_TIMEOUT_MS = 60_000;

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
