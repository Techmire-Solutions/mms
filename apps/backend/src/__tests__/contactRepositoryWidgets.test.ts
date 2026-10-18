import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContactsWidgetQuery } from "@mms/shared";

const mockWithTenantTransaction = vi.fn();

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (...args: unknown[]) => mockWithTenantTransaction(...args),
  // Read paths now go through withTenantRead (read replica + read-only tx).
  withTenantRead: (...args: unknown[]) => mockWithTenantTransaction(...args),
}));

import { aggregateContactsWidgetQueries } from "../db/repositories/contactRepositoryWidgets.js";

/**
 * Chainable fake tx: every query-builder method returns a node that is both
 * thenable (terminal `.where()`/`.limit()` resolve to the next queued rows) and
 * chainable (`.groupBy()`/`.orderBy()` continue the graph query). Rows are
 * consumed only at await time, in the exact order the repo issues queries.
 */
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

function baseQuery(overrides: Partial<ContactsWidgetQuery> = {}): ContactsWidgetQuery {
  return { id: "w1", operation: "count", ...overrides };
}

describe("contactRepositoryWidgets (SQL)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty map when no queries are provided", async () => {
    const { tx } = createChainableTx([]);
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (inner: typeof tx) => Promise<unknown>) => fn(tx),
    );

    await expect(aggregateContactsWidgetQueries("Demo", [])).resolves.toEqual({});
  });

  it("count operation reports filtered count and builds a top-N chart", async () => {
    const { tx } = createChainableTx([
      [{ count: 10 }], // total
      [{ count: 4 }], // filtered count
      [
        { name: "Male", value: 3 },
        { name: "Female", value: 1 },
      ], // chart
    ]);
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (inner: typeof tx) => Promise<unknown>) => fn(tx),
    );

    const result = await aggregateContactsWidgetQueries("Demo", [
      baseQuery({ id: "w1", operation: "count", xAxisField: "gender" }),
    ]);

    expect(result).toEqual({
      w1: {
        value: 4,
        totalCount: 10,
        chartData: [
          { name: "Male", value: 3 },
          { name: "Female", value: 1 },
        ],
      },
    });
    expect(tx.select).toHaveBeenCalledTimes(3);
  });

  it("percentage operation computes the share of the filtered count", async () => {
    const { tx } = createChainableTx([
      [{ count: 8 }], // total
      [{ count: 2 }], // filtered count
      [], // chart
    ]);
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (inner: typeof tx) => Promise<unknown>) => fn(tx),
    );

    const result = await aggregateContactsWidgetQueries("Demo", [
      baseQuery({ id: "w1", operation: "percentage" }),
    ]);

    expect(result.w1).toMatchObject({ value: 25, totalCount: 8 });
  });

  it("sum operation orders the numeric chart before applying the limit", async () => {
    const { tx, callLog } = createChainableTx([
      [{ count: 10 }], // total
      [{ sum: 25, count: 5 }], // aggregate
      [
        { name: "A", sum: 15, count: 3 },
        { name: "B", sum: 10, count: 2 },
      ], // numeric chart (count chart is skipped for sum/avg-with-target)
    ]);
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (inner: typeof tx) => Promise<unknown>) => fn(tx),
    );

    const result = await aggregateContactsWidgetQueries("Demo", [
      baseQuery({
        id: "w1",
        operation: "sum",
        targetField: "donationAmount",
        xAxisField: "gender",
        chartLimit: 8,
      }),
    ]);

    expect(result.w1).toMatchObject({
      value: 25,
      totalCount: 10,
      chartData: [
        { name: "A", value: 15 },
        { name: "B", value: 10 },
      ],
    });
    // The redundant count chart is no longer issued for a sum/avg-with-target
    // widget — only the numeric chart must ORDER BY before LIMIT.
    expect(callLog).toEqual(["orderBy", "limit:8"]);
  });

  it("avg operation rounds sum/count and orders by the average", async () => {
    const { tx } = createChainableTx([
      [{ count: 10 }], // total
      [{ sum: 30, count: 4 }], // aggregate
      [
        { name: "A", sum: 20, count: 2 },
        { name: "B", sum: 10, count: 2 },
      ], // numeric chart (no separate count chart)
    ]);
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (inner: typeof tx) => Promise<unknown>) => fn(tx),
    );

    const result = await aggregateContactsWidgetQueries("Demo", [
      baseQuery({
        id: "w1",
        operation: "avg",
        targetField: "donationAmount",
        xAxisField: "gender",
      }),
    ]);

    expect(result.w1).toMatchObject({
      value: 8, // round(30/4)
      chartData: [
        { name: "A", value: 10 },
        { name: "B", value: 5 },
      ],
    });
  });

  it("sum with an empty target field reports zero value and still builds a count chart", async () => {
    const { tx } = createChainableTx([
      [{ count: 10 }], // total
      [], // count chart
    ]);
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (inner: typeof tx) => Promise<unknown>) => fn(tx),
    );

    const result = await aggregateContactsWidgetQueries("Demo", [
      baseQuery({ id: "w1", operation: "sum", targetField: "", xAxisField: "gender" }),
    ]);

    expect(result.w1).toMatchObject({ value: 0, totalCount: 10, chartData: [] });
  });

  it("clamps chartLimit to the allowed range and passes it to the query", async () => {
    const { tx, callLog } = createChainableTx([[{ count: 10 }], [{ count: 2 }], []]);
    mockWithTenantTransaction.mockImplementation(
      async (_tenant: unknown, fn: (inner: typeof tx) => Promise<unknown>) => fn(tx),
    );

    await aggregateContactsWidgetQueries("Demo", [
      baseQuery({ id: "w1", operation: "count", chartLimit: 500 }),
    ]);

    expect(callLog).toContain("limit:50");
  });
});
