import { afterAll, describe, expect, it, vi } from "vitest";
import {
  QUEUE_BULK_EXPORT,
  QueueAddTimeoutError,
  closeAllQueues,
  dispatchJobToQueue,
  getQueue,
  reconcileTimedOutQueueAdd,
} from "../worker/queues/index.js";

describe("queue.add timeout reconciliation", () => {
  afterAll(async () => {
    await closeAllQueues();
  });

  it("keeps polling until the job appears or the deadline passes", async () => {
    const getJob = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ id: "job-1" });
    const queue = { getJob } as unknown as Parameters<typeof reconcileTimedOutQueueAdd>[0];

    await expect(reconcileTimedOutQueueAdd(queue, "job-1", 300)).resolves.toBe(true);
    expect(getJob).toHaveBeenCalledTimes(3);
  });

  it("returns false when the job never lands within the reconciliation window", async () => {
    const queue = {
      getJob: vi.fn().mockResolvedValue(null),
    } as unknown as Parameters<typeof reconcileTimedOutQueueAdd>[0];

    await expect(reconcileTimedOutQueueAdd(queue, "job-2", 150)).resolves.toBe(false);
  });

  it("treats a timed-out add as enqueued when getJob subsequently finds the job", async () => {
    const queue = getQueue(QUEUE_BULK_EXPORT);
    vi.spyOn(queue, "add").mockRejectedValueOnce(new QueueAddTimeoutError());
    vi.spyOn(queue, "getJob").mockResolvedValue({
      id: "job-landed",
    } as Awaited<ReturnType<typeof queue.getJob>>);

    const result = await dispatchJobToQueue(
      "alpha",
      "user-1",
      {
        id: "job-landed",
        moduleId: "contacts",
        kind: "export",
        label: "Export",
        status: "pending",
        createdAt: new Date().toISOString(),
      },
      {},
    );

    expect(result).toBe(true);
  });
});
