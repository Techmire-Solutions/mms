import { describe, expect, it, vi } from "vitest";
import { removeRetainedJob } from "../worker/queues/replaceRetainedJob.js";

describe("removeRetainedJob", () => {
  it("removes a retained job so the same id can be re-enqueued", async () => {
    const remove = vi.fn(async () => undefined);
    const queue = { getJob: vi.fn(async () => ({ remove })) };

    await expect(removeRetainedJob(queue, "job-1")).resolves.toBe(true);
    expect(queue.getJob).toHaveBeenCalledWith("job-1");
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("reports false when the job is already gone", async () => {
    const queue = { getJob: vi.fn(async () => null) };
    await expect(removeRetainedJob(queue, "job-1")).resolves.toBe(false);
  });
});
