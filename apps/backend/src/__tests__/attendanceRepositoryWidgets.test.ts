import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WidgetQuery } from "@mms/shared";

const mockWithTenantTransaction = vi.fn();

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (...args: unknown[]) => mockWithTenantTransaction(...args),
  // Read paths now go through withTenantRead (read replica + read-only tx).
  withTenantRead: (...args: unknown[]) => mockWithTenantTransaction(...args),
}));

import { aggregateAttendanceWidgetQueries } from "../db/repositories/attendanceRepositoryWidgets.js";

function createChainableTx(rowsQueue: unknown[][]) {
  let queueIndex = 0;
  const callLog: string[] = [];

  const makeNode = (): any => ({
    then: (resolve: (v: unknown) => void) => resolve(rowsQueue[queueIndex++] ?? []),
    from: () => makeNode(),
    where: () => makeNode(),
    groupBy: () => makeNode(),
    orderBy: () => {
      callLog.push("orderBy");
      return makeNode();
    },
    limit: (limitValue: number) => {
      callLog.push(`limit:${limitValue}`);
      return makeNode();
    },
  });

  const tx = {
    select: vi.fn(() => makeNode()),
  };

  return { tx, callLog };
}

describe("attendanceRepositoryWidgets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty map when no queries are provided", async () => {
    const { tx } = createChainableTx([]);
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (inner: typeof tx) => Promise<unknown>) => fn(tx),
    );

    await expect(aggregateAttendanceWidgetQueries("Demo", [])).resolves.toEqual({});
  });

  it("safely handles non-numeric gt/lt filter values without throwing NaN errors", async () => {
    // totalCount row, count row, chart rows
    const { tx } = createChainableTx([
      [{ count: 10 }],
      [{ count: 10 }],
      [{ name: "present", value: 10 }],
    ]);
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (inner: typeof tx) => Promise<unknown>) => fn(tx),
    );

    const query: WidgetQuery = {
      id: "w-invalid",
      operation: "count",
      filterField: "status",
      filterOperator: "gt",
      filterValue: "invalid-not-a-number",
    };

    const res = await aggregateAttendanceWidgetQueries("demo", [query]);
    expect(res["w-invalid"]).toBeDefined();
    expect(res["w-invalid"]?.value).toBe(10);
  });
});
