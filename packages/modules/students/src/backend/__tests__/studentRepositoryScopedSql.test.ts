import { beforeEach, describe, expect, it, vi } from "vitest";

const capturedWhere: unknown[] = [];
const capturedUpdateWhere: unknown[] = [];

/** Thenable builder that also supports the groupBy/orderBy/limit tail used by widgets. */
function resultChain(rows: unknown[]) {
  const promise = Promise.resolve(rows);
  const builder: {
    then: typeof promise.then;
    groupBy: () => typeof builder;
    orderBy: () => typeof builder;
    limit: () => typeof builder;
  } = {
    then: promise.then.bind(promise),
    groupBy: () => builder,
    orderBy: () => builder,
    limit: () => builder,
  };
  return builder;
}

function chain(rows: unknown[]) {
  const where = (condition: unknown) => {
    capturedWhere.push(condition);
    return resultChain(rows);
  };
  return {
    from: () => ({
      where,
      leftJoin: () => ({ where }),
    }),
  };
}

const mockTx = {
  select: vi.fn(() =>
    chain([{ count: 0, total: 0, active: 0, inactive: 0, suspended: 0, newThisPeriod: 0 }]),
  ),
  selectDistinct: vi.fn(() => chain([])),
  update: vi.fn(() => ({
    set: () => ({
      where: (condition: unknown) => {
        capturedUpdateWhere.push(condition);
        return {
          returning: () => Promise.resolve([{ id: "s-1" }]),
        };
      },
    }),
  })),
};

vi.mock("@mms/db/context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mms/db/context")>()),

  withTenantRead: async (_tenant: string, work: (tx: typeof mockTx) => Promise<unknown>) =>
    work(mockTx),
  withTenant: async (_tenant: string, work: (tx: typeof mockTx) => Promise<unknown>) =>
    work(mockTx),
}));

import { countStudentsByWorkspace } from "../repository/db/studentRepositoryHydrate.js";
import { aggregateStudentsCommandMetrics } from "../repository/db/studentRepositoryListMetrics.js";
import { aggregateStudentsWidgetQueries } from "../repository/db/studentRepositoryWidgetsAggregate.js";
import { bulkUpdateStudentsStatusSql } from "../repository/db/studentRepositoryList.js";

function renderSql(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const name = (value as Record<symbol, unknown>)[Symbol.for("drizzle:Name")];
    if (typeof name === "string") return name;
    if ("queryChunks" in value) {
      return (value as { queryChunks: unknown[] }).queryChunks.map(renderSql).join("");
    }
    if ("value" in value) return String((value as { value: unknown }).value ?? "");
    if ("name" in value) return String((value as { name: unknown }).name ?? "");
    if ("table" in value) return renderSql((value as { table: unknown }).table);
  }
  return String(value);
}

function renderedWheres(): string[] {
  return capturedWhere.map(renderSql);
}

describe("scoped student aggregate SQL", () => {
  beforeEach(() => {
    capturedWhere.length = 0;
    capturedUpdateWhere.length = 0;
    vi.clearAllMocks();
  });

  it("applies the section predicate to the count query", async () => {
    await countStudentsByWorkspace("demo", { scopedSectionIds: ["sec-1"] });

    const where = renderedWheres().join(" ");
    expect(where).toContain("sec-1");
    expect(where).toContain("section_id");
    expect(where).toContain("status");
  });

  it("denies the count query entirely for an empty scope", async () => {
    await countStudentsByWorkspace("demo", { scopedSectionIds: [] });

    expect(renderedWheres().join(" ")).toContain("1 = 0");
  });

  it("applies the section predicate to command metrics", async () => {
    await aggregateStudentsCommandMetrics("demo", undefined, ["sec-1"]);

    expect(renderedWheres().join(" ")).toContain("sec-1");
  });

  it("does not scope metrics for unrestricted callers", async () => {
    await aggregateStudentsCommandMetrics("demo");

    expect(renderedWheres().join(" ")).not.toContain("sec-1");
  });

  it("applies the section predicate to widget aggregates (total + per widget)", async () => {
    await aggregateStudentsWidgetQueries("demo", [{ id: "w1", operation: "count" }], ["sec-1"]);

    const wheres = renderedWheres();
    expect(wheres.length).toBeGreaterThanOrEqual(2);
    for (const where of wheres) {
      expect(where).toContain("sec-1");
    }
  });

  it("returns the ids the bulk status UPDATE wrote", async () => {
    const result = await bulkUpdateStudentsStatusSql("demo", ["s-1"], "inactive", "u-1");

    expect(result).toEqual({ succeeded: 1, updatedIds: ["s-1"] });
    expect(capturedUpdateWhere.length).toBe(1);
  });
});
