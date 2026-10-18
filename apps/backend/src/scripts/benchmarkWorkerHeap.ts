import {
  dispatchJobToQueue,
  getQueue,
  closeAllQueues,
  QUEUE_PDF_RENDERING,
  QUEUE_BULK_EXPORT,
  QUEUE_MESSAGING_BROADCAST,
  DEFAULT_JOB_OPTIONS,
} from "../worker/queues/index.js";
import type { BackgroundJobRecord } from "@mms/shared";
import { logger } from "../lib/logger.js";

async function runBenchmark(): Promise<void> {
  logger.info("Starting Worker Memory Benchmark (500 Concurrent Tasks)...");

  // Stub queue.add for high-throughput in-memory benchmark
  const queues = [QUEUE_PDF_RENDERING, QUEUE_BULK_EXPORT, QUEUE_MESSAGING_BROADCAST];
  for (const qName of queues) {
    const q = getQueue(qName);
    q.add = (async (_name, _data, _opts) => ({
      id: `mock-job-${Math.random().toString(36).substring(2, 9)}`,
    })) as typeof q.add;
  }

  if (typeof globalThis.gc === "function") {
    globalThis.gc();
  }
  const memBefore = process.memoryUsage();

  const jobKinds = [
    "export-pdf",
    "export-csv",
    "whatsapp-broadcast",
    "fee-receipt-pdf",
    "export-vcf",
    "generate-report-card",
  ];
  const tenantId = "benchmark-tenant";
  const userId = "bench-user-01";

  const startTime = performance.now();
  const dispatchPromises: Promise<boolean>[] = [];

  for (let i = 0; i < 500; i++) {
    const kind = jobKinds[i % jobKinds.length]!;
    const moduleId = kind.includes("whatsapp") ? "messaging" : "contacts";
    const job: BackgroundJobRecord = {
      id: `bench-job-${i}`,
      moduleId,
      kind,
      label: `Bench Job ${i}`,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    dispatchPromises.push(
      dispatchJobToQueue(tenantId, userId, job, {
        index: i,
        payloadData: `data-chunk-${i}-${"x".repeat(128)}`,
        extraUnusedField: undefined, // test undefined field trimming
      }),
    );
  }

  const results = await Promise.all(dispatchPromises);
  const durationMs = performance.now() - startTime;

  if (typeof globalThis.gc === "function") {
    globalThis.gc();
  }
  const memAfter = process.memoryUsage();
  const heapDeltaMb = (memAfter.heapUsed - memBefore.heapUsed) / (1024 * 1024);

  logger.info(
    {
      totalTasks: results.length,
      successCount: results.filter(Boolean).length,
      durationMs: Math.round(durationMs),
      throughputRps: Math.round((500 / durationMs) * 1000),
      heapBeforeMb: Math.round(memBefore.heapUsed / (1024 * 1024)),
      heapAfterMb: Math.round(memAfter.heapUsed / (1024 * 1024)),
      heapDeltaMb: Math.round(heapDeltaMb * 100) / 100,
      jobRetention: DEFAULT_JOB_OPTIONS.removeOnComplete,
    },
    "Benchmark Completed Successfully",
  );

  await closeAllQueues();

  if (heapDeltaMb > 50) {
    logger.error({ heapDeltaMb }, "Heap delta exceeded 50MB bound!");
    process.exit(1);
  }

  process.exit(0);
}

runBenchmark().catch((err) => {
  logger.fatal({ err }, "Benchmark failed unexpectedly");
  process.exit(1);
});
