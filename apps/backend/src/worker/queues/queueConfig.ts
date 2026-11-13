import type { JobsOptions } from "bullmq";

export const QUEUE_PDF_RENDERING = "pdf-rendering";
export const QUEUE_BULK_EXPORT = "bulk-export";
export const QUEUE_MESSAGING_BROADCAST = "messaging-broadcast";
/** Long-running session rollover jobs get their own queue so CSV exports/imports cannot starve. */
export const QUEUE_SESSIONS_ROLLOVER = "sessions-rollover";
/** Point-award pipelines get their own queue so a long award cannot starve every module's export. */
export const QUEUE_HASANAT_AWARDS = "hasanat-awards";
/**
 * Examinations marks imports and broadsheet exports are the module's heavy jobs; they get their own
 * queue so a slow session/student export cannot starve grade work (and vice versa).
 */
export const QUEUE_EXAMINATIONS = "examinations";
/**
 * Question Bank bulk imports/exports and (later) item-analysis rollups. Heavy jobs get their own
 * sandboxed queue so a large import cannot be time-boxed by, or starve, the shared export queue.
 */
export const QUEUE_QUESTION_BANK = "question-bank";
/** Workshops participant imports/notifications: DB-bound work with its own retry budget. */
export const QUEUE_WORKSHOPS = "workshops";

export interface QueueConcurrencyAndPriority {
  concurrency: number;
  priority: number;
}

/**
 * PDF renders run the Typst CLI as a child process. The compiler's slot semaphore is
 * per-process (each sandboxed worker is a fork), so the queue concurrency is the real global
 * bound: more concurrent renders means more 512 MB child heaps plus Typst processes.
 */
const PDF_RENDER_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.PDF_RENDER_CONCURRENCY || "2", 10),
);

export const QUEUE_SETTINGS: Record<string, QueueConcurrencyAndPriority> = {
  [QUEUE_PDF_RENDERING]: {
    concurrency: PDF_RENDER_CONCURRENCY,
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
  [QUEUE_HASANAT_AWARDS]: {
    concurrency: 2,
    priority: 2,
  },
  [QUEUE_EXAMINATIONS]: {
    concurrency: 2,
    priority: 2,
  },
  [QUEUE_QUESTION_BANK]: {
    concurrency: 2,
    priority: 2,
  },
  [QUEUE_WORKSHOPS]: {
    concurrency: 2,
    priority: 2,
  },
};

/** Queues served by a forked sandboxed processor (memory ceiling + child-process isolation). */
export const SANDBOXED_PDF_QUEUES: readonly string[] = [QUEUE_PDF_RENDERING];
export const SANDBOXED_EXPORT_QUEUES: readonly string[] = [
  QUEUE_BULK_EXPORT,
  QUEUE_EXAMINATIONS,
  QUEUE_QUESTION_BANK,
];
export const SANDBOXED_QUEUE_NAMES: readonly string[] = [
  ...SANDBOXED_PDF_QUEUES,
  ...SANDBOXED_EXPORT_QUEUES,
];

/**
 * Lock/stall policy for the sandboxed workers.
 *
 * `maxStalledCount` deliberately exceeds 1: a deploy that force-closes a child must lead to a retry
 * (the runners are replay-safe), not to a dead letter on the first missed lock renewal. The lock
 * duration stays 60 s; BullMQ renews it while the child is alive.
 */
export function sandboxedWorkerOptions(): {
  lockDuration: number;
  maxStalledCount: number;
  stalledInterval: number;
} {
  return { lockDuration: 60_000, maxStalledCount: 3, stalledInterval: 30_000 };
}

export { getBullMQConnectionOptions } from "../../lib/redis.js";
export { getQueuePrefix } from "../../lib/redisBullMQ.js";

export const WORKER_HEAP_LIMIT_BYTES =
  (Number(process.env.WORKER_HEAP_LIMIT_MB) || 512) * 1024 * 1024;

export const WORKER_SUBPROCESS_MEMORY_LIMIT_MB = 512;
export const JOB_EXECUTION_TIMEOUT_MS = 60_000;

/** Overdue marking + reminder dispatch for one workspace (bulk status, then sends). */
export const FINANCE_AUTOMATION_OVERDUE_TIMEOUT_MS =
  Number(process.env.FINANCE_AUTOMATION_OVERDUE_TIMEOUT_MS) || 5 * 60_000;
/** One billing period of generated invoices across a workspace's enrollments. */
export const FINANCE_AUTOMATION_GENERATE_TIMEOUT_MS =
  Number(process.env.FINANCE_AUTOMATION_GENERATE_TIMEOUT_MS) || 10 * 60_000;
/** A period-end revaluation / IAS 29 restatement over one workspace's ledger. */
export const FINANCE_AUTOMATION_REVALUE_TIMEOUT_MS =
  Number(process.env.FINANCE_AUTOMATION_REVALUE_TIMEOUT_MS) || 5 * 60_000;
/** Session rollover walks up to 5,000 students, one transaction per student. */
export const SESSIONS_ROLLOVER_TIMEOUT_MS =
  Number(process.env.SESSIONS_ROLLOVER_TIMEOUT_MS) || 15 * 60_000;
/** 500-row imports / large CSV exports need more than the sandboxed 60s ceiling. */
export const SESSIONS_IMPORT_TIMEOUT_MS =
  Number(process.env.SESSIONS_IMPORT_TIMEOUT_MS) || 10 * 60_000;
export const SESSIONS_EXPORT_TIMEOUT_MS =
  Number(process.env.SESSIONS_EXPORT_TIMEOUT_MS) || 10 * 60_000;
/** Exam CSV exports/imports walk up to 5,000 rows; the 60s sandbox ceiling is too tight. */
export const EXAMINATIONS_EXPORT_TIMEOUT_MS =
  Number(process.env.EXAMINATIONS_EXPORT_TIMEOUT_MS) || 10 * 60_000;
export const EXAMINATIONS_IMPORT_TIMEOUT_MS =
  Number(process.env.EXAMINATIONS_IMPORT_TIMEOUT_MS) || 10 * 60_000;
/** A marks import / broadsheet export is one exam, but a large cohort still exceeds 60s. */
export const EXAMINATIONS_MARKS_IMPORT_TIMEOUT_MS =
  Number(process.env.EXAMINATIONS_MARKS_IMPORT_TIMEOUT_MS) || 5 * 60_000;
export const EXAMINATIONS_RESULTS_EXPORT_TIMEOUT_MS =
  Number(process.env.EXAMINATIONS_RESULTS_EXPORT_TIMEOUT_MS) || 5 * 60_000;
/** Enrollment imports resolve + write one row at a time (500-row body cap). */
export const ENROLLMENTS_IMPORT_TIMEOUT_MS =
  Number(process.env.ENROLLMENTS_IMPORT_TIMEOUT_MS) || 10 * 60_000;
/** Question Bank imports/exports validate and upsert up to 5,000 questions. */
export const QUESTION_BANK_IMPORT_TIMEOUT_MS =
  Number(process.env.QUESTION_BANK_IMPORT_TIMEOUT_MS) || 10 * 60_000;
export const QUESTION_BANK_EXPORT_TIMEOUT_MS =
  Number(process.env.QUESTION_BANK_EXPORT_TIMEOUT_MS) || 10 * 60_000;
/** Workshop participant imports walk up to 5,000 contacts in chunks. */
export const WORKSHOPS_IMPORT_TIMEOUT_MS =
  Number(process.env.WORKSHOPS_IMPORT_TIMEOUT_MS) || 10 * 60_000;
/** Student CSV imports and exports walk up to 5,000 rows. */
export const STUDENTS_IMPORT_TIMEOUT_MS =
  Number(process.env.STUDENTS_IMPORT_TIMEOUT_MS) || 10 * 60_000;
export const STUDENTS_EXPORT_TIMEOUT_MS =
  Number(process.env.STUDENTS_EXPORT_TIMEOUT_MS) || 10 * 60_000;

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
    "enrollments:import": ENROLLMENTS_IMPORT_TIMEOUT_MS,
    "enrollments:export": SESSIONS_EXPORT_TIMEOUT_MS,
    // Batched Hasanat awards/imports write hundreds of cards; the 60s sandbox ceiling is too tight.
    "hasanat:bulk-award": ENROLLMENTS_IMPORT_TIMEOUT_MS,
    "hasanat:import": ENROLLMENTS_IMPORT_TIMEOUT_MS,
    "hasanat:export": SESSIONS_EXPORT_TIMEOUT_MS,
    "students:import": STUDENTS_IMPORT_TIMEOUT_MS,
    "students:export": STUDENTS_EXPORT_TIMEOUT_MS,
    "students:bulk-status": STUDENTS_IMPORT_TIMEOUT_MS,
    // A manual scan walks every marked day of one workspace; the 60s sandbox ceiling is too tight.
    "attendance:absence-scan": SESSIONS_IMPORT_TIMEOUT_MS,
    "attendance:export": SESSIONS_EXPORT_TIMEOUT_MS,
    "examinations:export": EXAMINATIONS_EXPORT_TIMEOUT_MS,
    "examinations:import": EXAMINATIONS_IMPORT_TIMEOUT_MS,
    "examinations:marks-import": EXAMINATIONS_MARKS_IMPORT_TIMEOUT_MS,
    "examinations:results-export": EXAMINATIONS_RESULTS_EXPORT_TIMEOUT_MS,
    "questionbank:import": QUESTION_BANK_IMPORT_TIMEOUT_MS,
    "questionbank:export": QUESTION_BANK_EXPORT_TIMEOUT_MS,
    "questionbank:item-analysis": QUESTION_BANK_IMPORT_TIMEOUT_MS,
    "workshops:import": WORKSHOPS_IMPORT_TIMEOUT_MS,
    // Scheduled finance sweeps share the deadline helper even though they are not
    // BullMQ jobs: a tenant-wide collect or month-end revaluation must not be cut
    // off by the 60s sandbox default.
    "finance:automation-overdue": FINANCE_AUTOMATION_OVERDUE_TIMEOUT_MS,
    "finance:automation-remind": FINANCE_AUTOMATION_OVERDUE_TIMEOUT_MS,
    "finance:automation-generate": FINANCE_AUTOMATION_GENERATE_TIMEOUT_MS,
    "finance:automation-revalue": FINANCE_AUTOMATION_REVALUE_TIMEOUT_MS,
    "finance:automation-ias29": FINANCE_AUTOMATION_REVALUE_TIMEOUT_MS,
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
