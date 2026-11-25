import { z } from "zod";
import { monthKeySchema } from "../core/monthKeySchema.js";

export const financeReportComparisonSessionSchema = z.object({
  sessionId: z.string(),
  feeCollected: z.number().nonnegative(),
});

export const financeReportComparisonMonthSchema = z.object({
  monthKey: monthKeySchema,
  collected: z.number().nonnegative(),
});

export const financeReportComparisonSchema = z.object({
  sessions: z.array(financeReportComparisonSessionSchema),
  monthly: z.object({
    a: z.array(financeReportComparisonMonthSchema),
    b: z.array(financeReportComparisonMonthSchema),
  }),
});

export const financeMonthlyFeeCollectionItemSchema = z.object({
  month: z.string(),
  collected: z.number().nonnegative(),
  outstanding: z.number().nonnegative(),
  total: z.number().nonnegative(),
  rate: z.number().min(0).max(100),
});

export const financeDiscountUsageByTypeItemSchema = z.object({
  type: z.string(),
  count: z.number().int().nonnegative(),
  totalDiscounted: z.number().nonnegative(),
  percentage: z.number().min(0).max(100),
});

/** ComparisonMode and dashboard finance aggregates (server aggregates). */
export const financeReportAggregatesSchema = z.object({
  comparison: financeReportComparisonSchema.optional(),
  monthlyFeeCollection: z.array(financeMonthlyFeeCollectionItemSchema).optional(),
  discountUsageByType: z.array(financeDiscountUsageByTypeItemSchema).optional(),
});

export type FinanceMonthlyFeeCollectionItem = z.infer<typeof financeMonthlyFeeCollectionItemSchema>;
export type FinanceDiscountUsageByTypeItem = z.infer<typeof financeDiscountUsageByTypeItemSchema>;
export type FinanceReportComparisonSession = z.infer<typeof financeReportComparisonSessionSchema>;
export type FinanceReportComparisonMonth = z.infer<typeof financeReportComparisonMonthSchema>;
export type FinanceReportComparison = z.infer<typeof financeReportComparisonSchema>;
export type FinanceReportAggregates = z.infer<typeof financeReportAggregatesSchema>;

import {
  type BaseReportComparisonQuery,
  normalizeReportComparisonQuery,
  reportComparisonQueryActive,
} from "../reports/reportComparisonQuery.js";

/** Optional ComparisonMode params for GET /finance/report-aggregates. */
export type FinanceReportComparisonQuery = BaseReportComparisonQuery;

export const EMPTY_FINANCE_REPORT_COMPARISON: FinanceReportComparison = {
  sessions: [],
  monthly: { a: [], b: [] },
};

export const EMPTY_FINANCE_REPORT_AGGREGATES: FinanceReportAggregates = {};

/**
 * Normalize ComparisonMode query params (max 2 sessionIds; ISO date ranges).
 */
export function normalizeFinanceReportComparisonQuery(
  input: FinanceReportComparisonQuery | undefined,
): FinanceReportComparisonQuery | undefined {
  return normalizeReportComparisonQuery(input);
}

/** True when any comparison SQL slice should run. */
export function financeReportComparisonQueryActive(
  query: FinanceReportComparisonQuery | undefined,
): boolean {
  return reportComparisonQueryActive(query);
}
