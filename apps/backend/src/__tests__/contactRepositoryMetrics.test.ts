import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FieldConfig } from "@mms/shared";

const mockWithTenantTransaction = vi.fn();

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

/** Chainable fake tx for the metrics queries (select → from → where terminal, plus groupBy for the monthly counts query). */
function createChainableTx(rowsQueue: unknown[][]) {
  let queueIndex = 0;
  const makeNode = (): any => ({
    then: (resolve: (v: unknown) => void) => resolve(rowsQueue[queueIndex++] ?? []),
    from: () => makeNode(),
    where: () => makeNode(),
    groupBy: () => makeNode(),
  });
  const tx = { select: vi.fn(() => makeNode()) };
  return { tx };
}

function runWithTx(tx: ReturnType<typeof createChainableTx>["tx"]) {
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
  });

  describe("aggregateContactsCommandMetrics", () => {
    it("maps the SQL aggregate row into the snapshot", async () => {
      const { tx } = createChainableTx([
        [{ total: 42, newThisPeriod: 5, whatsappCount: 30, incompleteCount: 3 }],
      ]);
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

    it("threads the duplicate-pair count option through", async () => {
      const { tx } = createChainableTx([
        [{ total: 1, newThisPeriod: 0, whatsappCount: 0, incompleteCount: 0 }],
      ]);
      runWithTx(tx);

      const result = await aggregateContactsCommandMetrics("Demo", EMPTY_FIELD_CONFIG, {
        duplicatePairCount: 4,
      });

      expect(result.duplicatePairCount).toBe(4);
    });

    it("handles a missing aggregate row as zeroed metrics", async () => {
      const { tx } = createChainableTx([[]]);
      runWithTx(tx);

      const result = await aggregateContactsCommandMetrics("Demo", EMPTY_FIELD_CONFIG);

      expect(result.total).toBe(0);
      expect(result.newThisPeriod).toBe(0);
    });
  });

  describe("aggregateContactsReportAnalytics", () => {
    it("maps totals and computes rates", async () => {
      const { tx } = createChainableTx([
        [
          {
            total: 100,
            whatsappCount: 25,
            missingInfoCount: 10,
            newLast30Days: 8,
            newPrior30Days: 6,
            newThisPeriod: 9,
            maxCreatedAt: null,
            signupCount: 0,
          },
        ],
      ]);
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

    it("runs the growth query when signup dates exist", async () => {
      const { tx } = createChainableTx([
        [
          {
            total: 100,
            whatsappCount: 0,
            missingInfoCount: 0,
            newLast30Days: 0,
            newPrior30Days: 0,
            newThisPeriod: 0,
            maxCreatedAt: "2026-07-01T00:00:00.000Z",
            signupCount: 12,
          },
        ],
        [{ recent: 4, prior: 3 }],
      ]);
      runWithTx(tx);

      const result = await aggregateContactsReportAnalytics("Demo");

      expect(result.hasSignupDates).toBe(true);
      expect(result.growthRecentSignups30d).toBe(4);
      expect(result.growthPriorSignups30d).toBe(3);
      expect(tx.select).toHaveBeenCalledTimes(2);
    });
  });

  describe("aggregateContactsMonthlyCreatedCounts", () => {
    it("returns an empty array when no years are requested", async () => {
      const { tx } = createChainableTx([]);
      runWithTx(tx);

      await expect(aggregateContactsMonthlyCreatedCounts("Demo", [])).resolves.toEqual([]);
      expect(tx.select).not.toHaveBeenCalled();
    });

    it("maps per-year SQL month rows onto the label window", async () => {
      const { tx } = createChainableTx([
        [
          { year: 2026, month: "01", count: 2 },
          { year: 2026, month: "03", count: 4 },
        ],
      ]);
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
  });
});
