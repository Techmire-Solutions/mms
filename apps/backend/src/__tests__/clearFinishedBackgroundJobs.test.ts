import { describe, expect, it, vi } from "vitest";

const { whereClauses, deletedIds } = vi.hoisted(() => ({
  whereClauses: [] as unknown[],
  deletedIds: ["job-1", "job-2"],
}));

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => "tenant-1",
}));
vi.mock("../db/tenant-context.js", () => ({
  withTenant: async (_tenant: string, callback: (tx: unknown) => Promise<unknown>) =>
    callback({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "user-1" }],
          }),
        }),
      }),
      delete: () => ({
        where: (clause: unknown) => {
          whereClauses.push(clause);
          return {
            returning: async () => deletedIds.map((id) => ({ id })),
          };
        },
      }),
    }),
}));

import {
  CLEARABLE_BACKGROUND_JOB_STATUSES,
  clearFinishedUserBackgroundJobs,
} from "../services/backgroundJobService.js";

/** Collects bound parameter values from a Drizzle SQL clause. */
function collectSqlParams(clause: unknown): unknown[] {
  const params: unknown[] = [];
  const walk = (node: unknown, depth = 0): void => {
    if (!node || typeof node !== "object" || depth > 8) return;
    const record = node as Record<string, unknown>;
    if ("value" in record && !("queryChunks" in record)) {
      const value = record.value;
      if (Array.isArray(value)) params.push(...value);
      else params.push(value);
      return;
    }
    if (Array.isArray(record.queryChunks)) {
      for (const chunk of record.queryChunks) walk(chunk, depth + 1);
    }
  };
  walk(clause);
  return params;
}

describe("clearFinishedUserBackgroundJobs", () => {
  it("deletes only completed and failed jobs and returns their ids", async () => {
    const removed = await clearFinishedUserBackgroundJobs("user-1");

    expect(removed).toEqual(["job-1", "job-2"]);
    const params = collectSqlParams(whereClauses[0]);
    expect(params).toContain("completed");
    expect(params).toContain("failed");
    expect(params).not.toContain("running");
    expect(params).not.toContain("pending");
  });

  it("pins the clearable status allow-list", () => {
    expect([...CLEARABLE_BACKGROUND_JOB_STATUSES]).toEqual(["completed", "failed"]);
  });
});
