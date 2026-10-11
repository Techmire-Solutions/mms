import { describe, it, expect } from "vitest";
import {
  accountingCommandMetricsSnapshotSchema,
  obligationsCommandMetricsSnapshotSchema,
  hasanatCommandMetricsSnapshotSchema,
} from "./moduleCommandMetricsFinance.js";

describe("Financial Command Metrics Zod Runtime Schemas", () => {
  describe("accountingCommandMetricsSnapshotSchema", () => {
    it("successfully parses a valid nominal metrics snapshot", () => {
      const valid = {
        totalEntries: 150,
        posted: 140,
        draft: 10,
        activeAccounts: 25,
        inactiveAccounts: 2,
        newThisPeriod: 12,
        postedVolume: 54000.5,
        revenue: 80000,
        expenses: 65000,
        surplus: 15000,
        assets: 120000,
        liabilities: 45000,
      };

      const result = accountingCommandMetricsSnapshotSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.totalEntries).toBe(150);
        expect(result.data.surplus).toBe(15000);
      }
    });

    it("successfully parses boundary values with all zeros and negative surplus", () => {
      const boundary = {
        totalEntries: 0,
        posted: 0,
        draft: 0,
        activeAccounts: 0,
        inactiveAccounts: 0,
        newThisPeriod: 0,
        postedVolume: 0,
        revenue: 0,
        expenses: 500,
        surplus: -500,
        assets: 0,
        liabilities: 500,
      };

      const result = accountingCommandMetricsSnapshotSchema.safeParse(boundary);
      expect(result.success).toBe(true);
    });

    it("rejects negative counts for non-negative fields", () => {
      const invalid = {
        totalEntries: -1,
        posted: 10,
        draft: 0,
        activeAccounts: 5,
        inactiveAccounts: 0,
        newThisPeriod: 0,
        postedVolume: 0,
        revenue: 100,
        expenses: 50,
        surplus: 50,
        assets: 100,
        liabilities: 50,
      };

      const result = accountingCommandMetricsSnapshotSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects floating point values for integer fields", () => {
      const invalid = {
        totalEntries: 10.5,
        posted: 10,
        draft: 0,
        activeAccounts: 5,
        inactiveAccounts: 0,
        newThisPeriod: 0,
        postedVolume: 0,
        revenue: 100,
        expenses: 50,
        surplus: 50,
        assets: 100,
        liabilities: 50,
      };

      const result = accountingCommandMetricsSnapshotSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("rejects extra unrecognized fields due to .strict() constraint", () => {
      const invalid = {
        totalEntries: 10,
        posted: 10,
        draft: 0,
        activeAccounts: 5,
        inactiveAccounts: 0,
        newThisPeriod: 0,
        postedVolume: 0,
        revenue: 100,
        expenses: 50,
        surplus: 50,
        assets: 100,
        liabilities: 50,
        unrecognizedField: "malicious-data",
      };

      const result = accountingCommandMetricsSnapshotSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("obligationsCommandMetricsSnapshotSchema", () => {
    it("validates nominal obligations snapshot", () => {
      const valid = {
        total: 50,
        totalAmount: 12500.75,
        cash: 5000,
        online: 7500.75,
        newThisPeriod: 8,
        obligationTypes: 4,
      };
      const result = obligationsCommandMetricsSnapshotSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("rejects unrecognized extra fields on obligations schema", () => {
      const invalid = {
        total: 50,
        totalAmount: 12500.75,
        cash: 5000,
        online: 7500.75,
        newThisPeriod: 8,
        obligationTypes: 4,
        extra: true,
      };
      const result = obligationsCommandMetricsSnapshotSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("hasanatCommandMetricsSnapshotSchema", () => {
    it("validates nominal hasanat snapshot", () => {
      const valid = {
        totalStock: 1000,
        available: 800,
        distributed: 200,
        redeemed: 50,
        active: 150,
        returned: 0,
        denominations: 5,
        totalPointsDistributed: 50000,
        pointsThisWeek: 3500,
        pointsLastWeek: 4200,
      };
      const result = hasanatCommandMetricsSnapshotSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });
});
