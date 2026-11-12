import { describe, expect, it } from "vitest";
import { runAttachmentSweep } from "../services/attachmentSweepService.js";
import {
  abortAndDrainRetentionCycle,
  runRetentionPurgeCycle,
} from "../worker/retentionPurgeScheduler.js";

describe("attachment sweep abort and retention drain", () => {
  it("refuses to scan or unlink once the sweep signal is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    let loaded = false;
    await expect(
      runAttachmentSweep({
        apply: true,
        signal: controller.signal,
        root: "/tmp/mms-nonexistent-sweep-root",
        loadReferencedKeys: async () => {
          loaded = true;
          return new Set();
        },
      }),
    ).rejects.toThrow(/aborted/i);
    // The reference load never ran, so no deletion could have been decided from a partial set.
    expect(loaded).toBe(false);
  });

  it("stops the retention cycle between tenants when aborted", async () => {
    const fakeDb = {
      select: () => ({ from: async () => [{ subdomain: "tenant-a" }, { subdomain: "tenant-b" }] }),
    } as never;
    const controller = new AbortController();
    controller.abort();
    await expect(runRetentionPurgeCycle(fakeDb, controller.signal)).rejects.toThrow(/aborted/i);
  });

  it("drains without an in-flight cycle", async () => {
    await expect(abortAndDrainRetentionCycle(50)).resolves.toBeUndefined();
  });
});
