import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteWhereClauses, deleteRows } = vi.hoisted(() => ({
  deleteWhereClauses: [] as unknown[],
  deleteRows: [] as Array<{ id: string; userId: string }>,
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
          deleteWhereClauses.push(clause);
          return { returning: async () => deleteRows };
        },
      }),
    }),
}));

import { dismissUserBackgroundJob } from "../services/backgroundJobService.js";

function collectSqlParams(clause: unknown): unknown[] {
  const params: unknown[] = [];
  const walk = (node: unknown, depth = 0): void => {
    if (!node || typeof node !== "object" || depth > 8) return;
    const record = node as Record<string, unknown>;
    if ("value" in record && !("queryChunks" in record)) {
      params.push(record.value);
      return;
    }
    if (Array.isArray(record.queryChunks)) {
      for (const chunk of record.queryChunks) walk(chunk, depth + 1);
    }
  };
  walk(clause);
  return params;
}

describe("dismissUserBackgroundJob ownership", () => {
  beforeEach(() => {
    deleteWhereClauses.length = 0;
    deleteRows.length = 0;
  });

  it("filters by tenant, job, and caller and returns the owner id", async () => {
    deleteRows.push({ id: "job-1", userId: "owner-9" });

    const ownerId = await dismissUserBackgroundJob("user-1", "job-1");

    expect(ownerId).toBe("owner-9");
    const params = collectSqlParams(deleteWhereClauses[0]);
    expect(params).toContain("tenant-1");
    expect(params).toContain("job-1");
    expect(params).toContain("user-1");
  });

  it("returns null when the job does not belong to the caller", async () => {
    const ownerId = await dismissUserBackgroundJob("user-1", "job-other");

    expect(ownerId).toBeNull();
    expect(collectSqlParams(deleteWhereClauses[0])).toContain("user-1");
  });
});
