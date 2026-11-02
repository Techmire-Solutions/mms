import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FieldConfig } from "@mms/shared";

const mockWithTenantTransaction = vi.fn();
const mockLoadWorkspaceRow = vi.fn();

vi.mock("../db/repositories/workspaceRepositoryCache.js", () => ({
  loadWorkspaceRow: (...args: unknown[]) => mockLoadWorkspaceRow(...args),
}));

vi.mock("../db/tenant-context.js", () => ({
  withTenant: (...args: unknown[]) => mockWithTenantTransaction(...args),
  // Read paths now go through withTenantRead (read replica + read-only tx).
  withTenantRead: (...args: unknown[]) => mockWithTenantTransaction(...args),
}));

import {
  aggregateContactsCommandMetrics,
  aggregateContactsMonthlyCreatedCounts,
  aggregateContactsReportAnalytics,
} from "../db/repositories/contactRepositoryMetrics.js";

/** Flattens a Drizzle SQL tree into readable text (SQL fragments + bound values). */
function collectSqlText(value: unknown, parts: string[] = []): string {
  if (value == null) return parts.join(" ");
  if (typeof value === "string") {
    parts.push(value);
    return parts.join(" ");
  }
  if (typeof value === "number" || typeof value === "boolean") {
    parts.push(String(value));
    return parts.join(" ");
  }
  if (value instanceof Date) {
    parts.push(value.toISOString());
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
  if (typeof record.value === "string" || typeof record.value === "number") {
    parts.push(String(record.value));
    return parts.join(" ");
  }
  if (typeof record.name === "string") {
    parts.push(record.name);
    return parts.join(" ");
  }
  return parts.join(" ");
}

/** SQL text of the first `select({...})` projection the metrics query built. */
function compiledSelectProjection(tx: { select: { mock: { calls: unknown[][] } } }): string {
  const projection = (tx.select.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
  return Object.values(projection)
    .map((column) => collectSqlText(column))
    .join(" | ");
}

/**
 * Chainable fake tx for the metrics queries: `execute` answers the raw-SQL
 * aggregate, `select` answers the growth/monthly queries.
 */
function createTx({
  executeRows = [] as unknown[],
  selectRows = [] as unknown[][],
}: { executeRows?: unknown[]; selectRows?: unknown[][] } = {}) {
  let queueIndex = 0;
  const makeNode = (): any => ({
    then: (resolve: (v: unknown) => void) => resolve(selectRows[queueIndex++] ?? []),
    from: () => makeNode(),
    where: () => makeNode(),
    groupBy: () => makeNode(),
  });
  const execute = vi.fn(async (_query: unknown) => ({ rows: executeRows }));
  const tx = { select: vi.fn(() => makeNode()), execute };
  return { tx, execute };
}

function runWithTx(tx: ReturnType<typeof createTx>["tx"]) {
  mockWithTenantTransaction.mockImplementation(
    async (_tenant: unknown, fn: (inner: typeof tx) => Promise<unknown>) => fn(tx),
  );
}

const EMPTY_FIELD_CONFIG: FieldConfig = {
  version: 1,
  enabledTabs: [],
  requiredTabs: [],
  fields: {},
};

describe("contactRepositoryMetrics (SQL)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadWorkspaceRow.mockResolvedValue({ timezone: "Asia/Karachi" });
  });

  describe("aggregateContactsCommandMetrics", () => {
    it("maps the SQL aggregate row into the snapshot", async () => {
      const { tx } = createTx({
        executeRows: [{ total: 42, newThisPeriod: 5, whatsappCount: 30, incompleteCount: 3 }],
      });
      runWithTx(tx);

      const result = await aggregateContactsCommandMetrics("Demo", EMPTY_FIELD_CONFIG, {
        periodDays: 7,
      });

      expect(result).toEqual({
        total: 42,
        newThisPeriod: 5,
        whatsappCount: 30,
        incompleteCount: 3,
        duplicatePairCount: 0,
      });
    });

    it("builds one lateral aggregate instead of a per-row WhatsApp subquery", async () => {
      const { tx, execute } = createTx({
        executeRows: [{ total: 2, newThisPeriod: 0, whatsappCount: 1, incompleteCount: 1 }],
      });
      runWithTx(tx);

      const result = await aggregateContactsCommandMetrics("Demo", EMPTY_FIELD_CONFIG);

      // Exactly one query for the whole command aggregate.
      expect(execute).toHaveBeenCalledTimes(1);
      expect(tx.select).not.toHaveBeenCalled();

      const compiled = collectSqlText(execute.mock.calls[0]?.[0]);
      expect(compiled).toContain("LEFT JOIN LATERAL");
      expect(compiled).toContain("ORDER BY p.is_primary DESC, p.sort_order ASC");
      expect(compiled).toContain("LIMIT 1");
      expect(compiled).toContain("length(pp.digits) BETWEEN 8 AND 15");
      // Subdomain is a bound parameter, not interpolated text.
      expect(compiled).toContain("demo");
      expect(result).toMatchObject({ total: 2, whatsappCount: 1, incompleteCount: 1 });
    });

    it("threads the duplicate-pair count option through", async () => {
      const { tx } = createTx({
        executeRows: [{ total: 1, newThisPeriod: 0, whatsappCount: 0, incompleteCount: 0 }],
      });
      runWithTx(tx);

      const result = await aggregateContactsCommandMetrics("Demo", EMPTY_FIELD_CONFIG, {
        duplicatePairCount: 4,
      });

      expect(result.duplicatePairCount).toBe(4);
    });

    it("handles a missing aggregate row as zeroed metrics", async () => {
      const { tx } = createTx();
      runWithTx(tx);

      const result = await aggregateContactsCommandMetrics("Demo", EMPTY_FIELD_CONFIG);

      expect(result).toEqual({
        total: 0,
        newThisPeriod: 0,
        whatsappCount: 0,
        incompleteCount: 0,
        duplicatePairCount: 0,
      });
    });
  });

  describe("aggregateContactsReportAnalytics", () => {
    it("maps totals and computes rates", async () => {
      const { tx } = createTx({
        executeRows: [
          {
            total: 100,
            whatsappCount: 25,
            missingInfoCount: 10,
            incompleteCount: 0,
            newLast30Days: 8,
            newPrior30Days: 6,
            newThisPeriod: 9,
            maxCreatedAt: null,
            signupCount: 0,
          },
        ],
      });
      runWithTx(tx);

      const result = await aggregateContactsReportAnalytics("Demo");

      expect(result.total).toBe(100);
      expect(result.whatsappCount).toBe(25);
      expect(result.whatsappRate).toBe(25);
      expect(result.missingInfoCount).toBe(10);
      expect(result.newLast30Days).toBe(8);
      expect(result.newPrior30Days).toBe(6);
      expect(result.newThisPeriod).toBe(9);
      expect(result.hasSignupDates).toBe(false);
      expect(result.growthRecentSignups30d).toBe(0);
      expect(result.growthPriorSignups30d).toBe(0);
    });

    it("handles a missing aggregate row as zeroed report analytics", async () => {
      const { tx } = createTx();
      runWithTx(tx);

      const result = await aggregateContactsReportAnalytics("Demo");

      expect(result).toMatchObject({
        total: 0,
        activeCount: 0,
        whatsappCount: 0,
        whatsappRate: 0,
        missingInfoCount: 0,
        newLast30Days: 0,
        newPrior30Days: 0,
        newThisPeriod: 0,
        hasSignupDates: false,
      });
    });

    it("runs the growth query when signup dates exist", async () => {
      const { tx } = createTx({
        executeRows: [
          {
            total: 100,
            whatsappCount: 0,
            missingInfoCount: 0,
            incompleteCount: 0,
            newLast30Days: 0,
            newPrior30Days: 0,
            newThisPeriod: 0,
            maxCreatedAt: "2026-07-01T00:00:00.000Z",
            signupCount: 12,
          },
        ],
        selectRows: [[{ recent: 4, prior: 3 }]],
      });
      runWithTx(tx);

      const result = await aggregateContactsReportAnalytics("Demo");

      expect(result.hasSignupDates).toBe(true);
      expect(result.growthRecentSignups30d).toBe(4);
      expect(result.growthPriorSignups30d).toBe(3);
      expect(tx.select).toHaveBeenCalledTimes(1);
    });
  });

  describe("aggregateContactsMonthlyCreatedCounts", () => {
    it("returns an empty array when no years are requested", async () => {
      const { tx } = createTx();
      runWithTx(tx);

      await expect(aggregateContactsMonthlyCreatedCounts("Demo", [])).resolves.toEqual([]);
      expect(tx.select).not.toHaveBeenCalled();
      expect(tx.execute).not.toHaveBeenCalled();
    });

    it("maps per-year SQL month rows onto the label window", async () => {
      const { tx } = createTx({
        selectRows: [
          [
            { year: 2026, month: "01", count: 2 },
            { year: 2026, month: "03", count: 4 },
          ],
        ],
      });
      runWithTx(tx);

      const result = await aggregateContactsMonthlyCreatedCounts("Demo", [2026], 3, "en");

      expect(result).toHaveLength(1);
      expect(result[0]?.year).toBe(2026);
      expect(result[0]?.months).toHaveLength(3);
      // Only January and March have counts; February is zero-filled.
      expect(result[0]?.months[0]).toMatchObject({ count: 2 });
      expect(result[0]?.months[1]).toMatchObject({ count: 0 });
      expect(result[0]?.months[2]).toMatchObject({ count: 4 });
    });

    it("buckets months in the workspace timezone, not the DB session timezone", async () => {
      const { tx } = createTx({ selectRows: [[]] });
      runWithTx(tx);

      await aggregateContactsMonthlyCreatedCounts("Demo", [2026], 3, "en");

      const compiled = compiledSelectProjection(tx);
      expect(compiled).toContain("AT TIME ZONE");
      expect(compiled).toContain("Asia/Karachi");
    });

    it("falls back to UTC when the workspace has no timezone configured", async () => {
      mockLoadWorkspaceRow.mockResolvedValue({ timezone: "" });
      const { tx } = createTx({ selectRows: [[]] });
      runWithTx(tx);

      await aggregateContactsMonthlyCreatedCounts("Demo", [2026], 3, "en");

      expect(compiledSelectProjection(tx)).toContain("UTC");
    });
  });
});
