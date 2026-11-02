import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContactsWidgetQuery } from "@mms/shared";

const mockWithTenantTransaction = vi.fn();

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (...args: unknown[]) => mockWithTenantTransaction(...args),
  // Read paths now go through withTenantRead (read replica + read-only tx).
  withTenantRead: (...args: unknown[]) => mockWithTenantTransaction(...args),
}));

import { aggregateContactsWidgetQueries } from "../db/repositories/contactRepositoryWidgets.js";

/** Flattens a Drizzle SQL tree into readable text (fragments + bound values). */
function collectSqlText(value: unknown, parts: string[] = []): string {
  if (value == null) return parts.join(" ");
  if (typeof value === "string") {
    parts.push(value);
    return parts.join(" ");
  }
  if (Array.isArray(value)) {
    for (const entry of value) collectSqlText(entry, parts);
    return parts.join(" ");
  }
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.queryChunks)) {
    collectSqlText(record.queryChunks, parts);
    return parts.join(" ");
  }
  if (Array.isArray(record.value)) {
    parts.push((record.value as unknown[]).map((entry) => String(entry)).join(""));
    return parts.join(" ");
  }
  if (typeof record.value === "string") {
    parts.push(record.value);
    return parts.join(" ");
  }
  if (typeof record.name === "string") {
    parts.push(record.name);
    return parts.join(" ");
  }
  return parts.join(" ");
}

/**
 * Chainable fake tx: every query-builder method returns a node that is both
 * thenable (terminal `.where()`/`.limit()` resolve to the next queued rows) and
 * chainable (`.groupBy()`/`.orderBy()` continue the graph query). Rows are
 * consumed only at await time, in the exact order the repo issues queries.
 */
function createChainableTx(rowsQueue: unknown[][]) {
  let queueIndex = 0;
  const callLog: string[] = [];
  const whereSql: string[] = [];

  const makeNode = (): any => ({
    then: (resolve: (v: unknown) => void) => resolve(rowsQueue[queueIndex++] ?? []),
    from: () => makeNode(),
    where: (condition: unknown) => {
      whereSql.push(collectSqlText(condition));
      return makeNode();
    },
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

  return { tx, callLog, whereSql };
}

function baseQuery(overrides: Partial<ContactsWidgetQuery> = {}): ContactsWidgetQuery {
  return { id: "w1", operation: "count", ...overrides };
}

function runWithTx(tx: ReturnType<typeof createChainableTx>["tx"]) {
  mockWithTenantTransaction.mockImplementation(
    async (_tenant: unknown, fn: (inner: typeof tx) => Promise<unknown>) => fn(tx),
  );
}

describe("contactRepositoryWidgets (SQL)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an empty map when no queries are provided", async () => {
    const { tx } = createChainableTx([]);
    runWithTx(tx);

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
    runWithTx(tx);

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
    runWithTx(tx);

    const result = await aggregateContactsWidgetQueries("Demo", [
      baseQuery({ id: "w1", operation: "percentage" }),
    ]);

    expect(result.w1).toMatchObject({ value: 25, totalCount: 8 });
  });

  it("ANDs the primary filter with every filters[] rule", async () => {
    const { tx, whereSql } = createChainableTx([[{ count: 10 }], [{ count: 4 }], []]);
    runWithTx(tx);

    await aggregateContactsWidgetQueries("Demo", [
      baseQuery({
        id: "w1",
        operation: "count",
        filterField: "gender",
        filterOperator: "equals",
        filterValue: "Male",
        filters: [
          { field: "isSyed", operator: "equals", value: "true" },
          { field: "whatsappStatus", operator: "contains", value: "verified" },
        ],
      }),
    ]);

    const filteredWhere = whereSql.join(" | ").toLowerCase();
    expect(filteredWhere).toContain("gender");
    expect(filteredWhere).toContain("is_syed");
    expect(filteredWhere).toContain("whatsapp_status");
  });

  it("supports the startsWith operator (previously silently ignored)", async () => {
    const { tx, whereSql } = createChainableTx([[{ count: 10 }], [{ count: 1 }], []]);
    runWithTx(tx);

    await aggregateContactsWidgetQueries("Demo", [
      baseQuery({
        id: "w1",
        operation: "count",
        filterField: "gender",
        filterOperator: "startsWith",
        filterValue: "Ma",
      }),
    ]);

    const filteredWhere = whereSql.join(" | ");
    expect(filteredWhere).toContain("LIKE");
    expect(filteredWhere).toContain("ma%");
  });

  it("rejects a numeric aggregate on a non-numeric contact field", async () => {
    runWithTx(createChainableTx([]).tx);

    await expect(
      aggregateContactsWidgetQueries("Demo", [
        baseQuery({ id: "w1", operation: "sum", targetField: "gender" }),
      ]),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      aggregateContactsWidgetQueries("Demo", [
        baseQuery({ id: "w1", operation: "avg", targetField: "isSyed" }),
      ]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("rejects an unknown filter or x-axis field instead of silently using gender", async () => {
    runWithTx(createChainableTx([]).tx);

    await expect(
      aggregateContactsWidgetQueries("Demo", [
        baseQuery({ id: "w1", operation: "count", filterField: "donationAmount" }),
      ]),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      aggregateContactsWidgetQueries("Demo", [
        baseQuery({ id: "w1", operation: "count", xAxisField: "city" }),
      ]),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("sum with an empty target field reports zero value and still builds a count chart", async () => {
    const { tx } = createChainableTx([
      [{ count: 10 }], // total
      [], // count chart
    ]);
    runWithTx(tx);

    const result = await aggregateContactsWidgetQueries("Demo", [
      baseQuery({ id: "w1", operation: "sum", targetField: "", xAxisField: "gender" }),
    ]);

    expect(result.w1).toMatchObject({ value: 0, totalCount: 10, chartData: [] });
  });

  it("clamps chartLimit to the allowed range and passes it to the query", async () => {
    const { tx, callLog } = createChainableTx([[{ count: 10 }], [{ count: 2 }], []]);
    runWithTx(tx);

    await aggregateContactsWidgetQueries("Demo", [
      baseQuery({ id: "w1", operation: "count", chartLimit: 500 }),
    ]);

    expect(callLog).toContain("limit:50");
  });
});
