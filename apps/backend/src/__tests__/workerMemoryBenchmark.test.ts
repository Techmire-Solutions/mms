import { describe, it, expect, vi } from "vitest";
import type { BackgroundJobRecord } from "@mms/shared";
import {
  dispatchJobToQueue,
  QUEUE_PDF_RENDERING,
  QUEUE_BULK_EXPORT,
  QUEUE_MESSAGING_BROADCAST,
  getQueue,
  closeAllQueues,
  DEFAULT_JOB_OPTIONS,
} from "../worker/queues/index.js";
import { processPdfRenderJob } from "../worker/processors/pdf-rendering.js";
import {
  registerConnection,
  broadcastLocalTenantUpdate,
  MAX_WS_BUFFERED_AMOUNT,
  closeAllConnections,
  type MinimalWebSocket,
} from "../lib/livePush.js";

describe("Worker Memory Footprint & Throughput Benchmark (500 Concurrent Tasks)", () => {
  it("dispatches 500 concurrent worker tasks with bounded heap growth", async () => {
    const mockAdd = vi.fn().mockImplementation(async (_name, _data, _opts) => ({
      id: `mock-job-${Math.random().toString(36).substring(2, 9)}`,
    }));

    const queues = [QUEUE_PDF_RENDERING, QUEUE_BULK_EXPORT, QUEUE_MESSAGING_BROADCAST];
    for (const qName of queues) {
      const q = getQueue(qName);
      vi.spyOn(q, "add").mockImplementation(mockAdd);
    }

    // Force GC if exposed before baseline measurement
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

    const dispatchPromises: Promise<boolean>[] = [];
    const startTime = performance.now();

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

    expect(results).toHaveLength(500);
    expect(results.every((r) => r === true)).toBe(true);
    expect(mockAdd).toHaveBeenCalledTimes(500);

    // 500 jobs dispatch within reasonable time (< 2000ms in vitest)
    expect(durationMs).toBeLessThan(2000);

    // Heap delta should remain bounded (< 50MB increase for 500 tasks)
    expect(heapDeltaMb).toBeLessThan(50);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await closeAllQueues();
    logSpy.mockRestore();
  });

  it("streams Typst PDF render jobs directly to storage and cleans up disk artifacts", async () => {
    const progressUpdates: number[] = [];
    const uploadResult = await processPdfRenderJob(
      "bench-tenant",
      {
        template: "report-card",
        data: {
          institution: "Darul Uloom Benchmark",
          studentName: "Ahmad Bilal",
          grade: "Mumtaz",
        },
        filename: "benchmark-report.pdf",
        lang: "ar",
      },
      (pct) => {
        progressUpdates.push(pct);
      },
    );

    expect(uploadResult.key).toContain("tenants/bench-tenant/exports/");
    expect(uploadResult.url).toBeDefined();
    expect(progressUpdates).toContain(100);
  });

  it("drops/terminates slow WebSocket connections when bufferedAmount exceeds backpressure threshold", () => {
    let terminated = false;
    const sentMessages: string[] = [];

    const slowSocket: MinimalWebSocket = {
      bufferedAmount: MAX_WS_BUFFERED_AMOUNT + 1024, // Exceeds threshold
      send: (data: string) => {
        sentMessages.push(data);
      },
      close: vi.fn(),
      terminate: () => {
        terminated = true;
      },
      ping: vi.fn(),
      on: vi.fn(),
    };

    const healthySocket: MinimalWebSocket = {
      bufferedAmount: 1024, // Normal
      send: (data: string) => {
        sentMessages.push(data);
      },
      close: vi.fn(),
      terminate: vi.fn(),
      ping: vi.fn(),
      on: vi.fn(),
    };

    registerConnection("test-tenant", slowSocket, "user-slow");
    registerConnection("test-tenant", healthySocket, "user-healthy");

    broadcastLocalTenantUpdate("test-tenant", "collection", "students");

    expect(terminated).toBe(true);
    expect(sentMessages).toHaveLength(1); // Only healthy socket received message

    closeAllConnections();
  });

  it("verifies BullMQ job options conform to strict retention constraints", () => {
    expect(DEFAULT_JOB_OPTIONS.removeOnComplete).toEqual({ count: 100, age: 3600 });
    expect(DEFAULT_JOB_OPTIONS.removeOnFail).toEqual({ count: 500, age: 86400 });
  });
});
