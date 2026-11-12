import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BackgroundJobRunContext } from "../services/backgroundJobWorkerService.js";

const importChunk = vi.fn();
vi.mock("../db/repositories/workshopParticipantImportRepository.js", () => ({
  importParticipantChunk: (...args: unknown[]) => importChunk(...args),
}));

import { runWorkshopParticipantImport } from "../workshops/jobs/workshopImportJob.js";

function makeContext(signal?: AbortSignal) {
  return {
    tenant: "demo",
    userId: "u-1",
    jobId: "job-1",
    signal,
    updateProgress: vi.fn().mockResolvedValue(undefined),
    complete: vi.fn().mockResolvedValue(undefined),
    fail: vi.fn().mockResolvedValue(undefined),
  } satisfies BackgroundJobRunContext;
}

const payload = (count: number) => ({
  workshopId: "w-1",
  contactIds: Array.from({ length: count }, (_, i) => `c-${i + 1}`),
});

describe("workshops:import runner", () => {
  beforeEach(() => {
    importChunk.mockReset();
  });

  it("chunks the import, reports progress, and completes with counts", async () => {
    importChunk.mockImplementation(async (_tenant, _workshopId, ids: string[]) => ({
      added: ids.length,
      waitlisted: 0,
      skipped: 0,
      failed: [],
    }));
    const ctx = makeContext();
    await runWorkshopParticipantImport(payload(250), ctx);

    expect(importChunk).toHaveBeenCalledTimes(3);
    expect(importChunk.mock.calls[0]?.[2]).toHaveLength(100);
    expect(importChunk.mock.calls[2]?.[2]).toHaveLength(50);
    expect(ctx.updateProgress).toHaveBeenLastCalledWith(250, 250);
    expect(ctx.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        label: expect.stringContaining("250 seated"),
        progress: { current: 250, total: 250 },
        errors: [],
      }),
    );
  });

  it("is retry-safe: already-registered contacts are reported as skipped", async () => {
    importChunk.mockResolvedValue({ added: 0, waitlisted: 0, skipped: 100, failed: [] });
    const ctx = makeContext();
    await runWorkshopParticipantImport(payload(100), ctx);
    expect(ctx.complete).toHaveBeenCalledWith(
      expect.objectContaining({ label: expect.stringContaining("100 already registered") }),
    );
  });

  it("maps per-contact failures to 1-based row numbers", async () => {
    importChunk.mockResolvedValue({
      added: 1,
      waitlisted: 0,
      skipped: 0,
      failed: [
        { contactId: "c-2", code: "capacity_full" },
        { contactId: "c-3", code: "contact_not_found" },
      ],
    });
    const ctx = makeContext();
    const ids = ["c-1", "c-2", "c-3"];
    await runWorkshopParticipantImport({ workshopId: "w-1", contactIds: ids }, ctx);
    expect(ctx.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        errors: [
          { row: 2, reason: "capacity_full" },
          { row: 3, reason: "contact_not_found" },
        ],
      }),
    );
  });

  it("stops between chunks when the shutdown/abort signal fires", async () => {
    const controller = new AbortController();
    importChunk.mockImplementation(async () => {
      controller.abort();
      return { added: 100, waitlisted: 0, skipped: 0, failed: [] };
    });
    const ctx = makeContext(controller.signal);
    await expect(runWorkshopParticipantImport(payload(250), ctx)).rejects.toThrow(/aborted/i);
    expect(importChunk).toHaveBeenCalledTimes(1);
    expect(ctx.complete).not.toHaveBeenCalled();
  });

  it("fails permanently on an invalid payload or a missing workshop", async () => {
    const invalid = makeContext();
    await runWorkshopParticipantImport({ workshopId: "w-1", contactIds: [] }, invalid);
    expect(invalid.fail).toHaveBeenCalledWith("Invalid workshop import payload");

    const { NotFoundError } = await import("../lib/httpErrors.js");
    importChunk.mockRejectedValue(new NotFoundError("Workshop not found"));
    const missing = makeContext();
    await runWorkshopParticipantImport(payload(1), missing);
    expect(missing.fail).toHaveBeenCalledWith("Workshop not found");
    expect(missing.complete).not.toHaveBeenCalled();
  });
});
