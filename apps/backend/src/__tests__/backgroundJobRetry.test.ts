import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackgroundJobRecord } from "@mms/shared";

const patches = vi.hoisted(() => [] as Array<Record<string, unknown>>);
vi.mock("../services/backgroundJobPatch.js", () => ({
  patchJob: async (
    _tenant: string,
    _user: string,
    _jobId: string,
    patch: Record<string, unknown>,
  ) => {
    patches.push(patch);
    return patch;
  },
}));

const dispatch = vi.hoisted(() => vi.fn(async () => true));
vi.mock("../worker/queues/index.js", () => ({ dispatchJobToQueue: dispatch }));

vi.mock("../services/backgroundJobService.js", () => ({
  BackgroundJobLimitError: class BackgroundJobLimitError extends Error {},
  countUserBackgroundJobs: vi.fn(async () => 0),
  createDatabaseBackgroundJob: vi.fn(async () => true),
  getUserBackgroundJob: vi.fn(async () => null),
}));

import {
  QueueUnavailableError,
  retryFailedBackgroundJob,
} from "../services/backgroundJobWorkerService.js";

const failedJob = {
  id: "demo:u-1:key",
  moduleId: "examinations",
  kind: "marks-import",
  status: "failed",
  label: "Import",
  error: "boom",
  completedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
} as BackgroundJobRecord;

const payload = { examId: "ex-1", rows: [{ rollNumber: "1", marksObtained: 80 }] };

describe("retryFailedBackgroundJob", () => {
  beforeEach(() => {
    patches.length = 0;
    dispatch.mockReset().mockResolvedValue(true);
  });

  it("resets the failed row and re-dispatches with the new payload", async () => {
    const job = await retryFailedBackgroundJob("demo", "u-1", failedJob, payload);

    expect(job.status).toBe("pending");
    expect(patches[0]).toMatchObject({ status: "pending", error: null, deadLetteredAt: null });
    expect(dispatch).toHaveBeenCalledWith(
      "demo",
      "u-1",
      expect.objectContaining({ id: failedJob.id, status: "pending" }),
      payload,
      { replaceExisting: true },
    );
  });

  it("only touches failed jobs", async () => {
    const completed = { ...failedJob, status: "completed" } as BackgroundJobRecord;
    await retryFailedBackgroundJob("demo", "u-1", completed, payload);
    expect(dispatch).not.toHaveBeenCalled();
    expect(patches).toHaveLength(0);
  });

  it("re-fails the row when the queue is unavailable", async () => {
    dispatch.mockResolvedValueOnce(false);
    await expect(
      retryFailedBackgroundJob("demo", "u-1", failedJob, payload),
    ).rejects.toBeInstanceOf(QueueUnavailableError);
    expect(patches.at(-1)).toMatchObject({ status: "failed" });
  });
});
