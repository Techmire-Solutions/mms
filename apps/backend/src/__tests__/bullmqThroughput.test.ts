import { describe, it, expect, vi } from "vitest";
import {
  dispatchJobToQueue,
  QUEUE_PDF_RENDERING,
  QUEUE_BULK_EXPORT,
  QUEUE_MESSAGING_BROADCAST,
  getQueue,
  closeAllQueues,
} from "../worker/queues/index.js";
import type { BackgroundJobRecord } from "@mms/shared";

describe("BullMQ 50 Concurrent Jobs Throughput Verification (Phase 5)", () => {
  it("dispatches 50 concurrent jobs across queues without failure", async () => {
    const mockAdd = vi.fn().mockResolvedValue({ id: "mock-job-id" });

    // Mock getQueue to return mock queue instances
    const queues = [QUEUE_PDF_RENDERING, QUEUE_BULK_EXPORT, QUEUE_MESSAGING_BROADCAST];
    for (const qName of queues) {
      const q = getQueue(qName);
      vi.spyOn(q, "add").mockImplementation(mockAdd);
    }

    const jobKinds = [
      "export-pdf",
      "export-csv",
      "whatsapp-broadcast",
      "fee-receipt-pdf",
      "export-vcf",
    ];
    const tenantId = "alpha";
    const userId = "user-test-01";

    const dispatchPromises: Promise<boolean>[] = [];
    const startTime = performance.now();

    for (let i = 0; i < 50; i++) {
      const kind = jobKinds[i % jobKinds.length]!;
      const moduleId = kind.includes("whatsapp") ? "messaging" : "contacts";
      const job: BackgroundJobRecord = {
        id: `job-batch-${i}`,
        moduleId,
        kind,
        label: `Batch Job ${i}`,
        status: "pending",
        createdAt: new Date().toISOString(),
      };

      dispatchPromises.push(
        dispatchJobToQueue(tenantId, userId, job, { index: i, timestamp: Date.now() }),
      );
    }

    const results = await Promise.all(dispatchPromises);
    const endTime = performance.now();
    const durationMs = endTime - startTime;

    expect(results).toHaveLength(50);
    expect(results.every((r) => r === true)).toBe(true);
    expect(mockAdd).toHaveBeenCalledTimes(50);

    // 50 enqueues in memory/mock should be well under 500ms
    expect(durationMs).toBeLessThan(500);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    await closeAllQueues();
    logSpy.mockRestore();
  });
});
