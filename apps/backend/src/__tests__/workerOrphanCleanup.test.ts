import { describe, expect, it, vi } from "vitest";

const sets: Array<Record<string, unknown>> = [];
const fakeTx = {
  update: () => ({
    set: (values: Record<string, unknown>) => {
      sets.push(values);
      return { where: () => ({ returning: async () => [] }) };
    },
  }),
};

vi.mock("../db/tenant-context.js", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, withGlobalTenant: (fn: (tx: unknown) => unknown) => fn(fakeTx) };
});

import { cleanupOrphanedJobs } from "../worker/workerOrphanCleanup.js";

describe("worker orphan cleanup", () => {
  it("marks a stale pending job as dead-lettered so it can be replayed", async () => {
    sets.length = 0;
    await cleanupOrphanedJobs();

    expect(sets.length).toBeGreaterThanOrEqual(2);
    expect(sets[0]?.status).toBe("failed");
    expect(sets[0]?.deadLetteredAt).toBeInstanceOf(Date);
    expect(sets[1]?.status).toBe("failed");
    // The pending-never-dispatched branch must be replayable too.
    expect(sets[1]?.deadLetteredAt).toBeInstanceOf(Date);
  });
});
