import { z } from "zod";
import { monthKeySchema } from "../core/monthKeySchema.js";

export const examinationsReportComparisonSessionSchema = z.object({
  sessionId: z.string(),
  passRatePct: z.number().nonnegative().max(100),
});

export const examinationsReportComparisonMonthSchema = z.object({
  monthKey: monthKeySchema,
  passCount: z.number().nonnegative(),
  totalCount: z.number().nonnegative(),
});

export const examinationsReportComparisonSchema = z.object({
  sessions: z.array(examinationsReportComparisonSessionSchema),
  monthly: z.object({
    a: z.array(examinationsReportComparisonMonthSchema),
    b: z.array(examinationsReportComparisonMonthSchema),
  }),
});

/** ComparisonMode examinations aggregates (optional comparison slice). */
export const examinationsReportAggregatesSchema = z.object({
  comparison: examinationsReportComparisonSchema.optional(),
});

export type ExaminationsReportComparisonSession = z.infer<
  typeof examinationsReportComparisonSessionSchema
>;
export type ExaminationsReportComparisonMonth = z.infer<
  typeof examinationsReportComparisonMonthSchema
>;
export type ExaminationsReportComparison = z.infer<typeof examinationsReportComparisonSchema>;
export type ExaminationsReportAggregates = z.infer<typeof examinationsReportAggregatesSchema>;

import {
  type BaseReportComparisonQuery,
  normalizeReportComparisonQuery,
  reportComparisonQueryActive,
} from "../reports/reportComparisonQuery.js";

/** Optional ComparisonMode params for GET /examinations/report-aggregates. */
export type ExaminationsReportComparisonQuery = BaseReportComparisonQuery;

export const EMPTY_EXAMINATIONS_REPORT_COMPARISON: ExaminationsReportComparison = {
  sessions: [],
  monthly: { a: [], b: [] },
};

export const EMPTY_EXAMINATIONS_REPORT_AGGREGATES: ExaminationsReportAggregates = {};

/**
 * Normalize ComparisonMode query params (max 2 sessionIds; ISO date ranges).
 */
export function normalizeExaminationsReportComparisonQuery(
  input: ExaminationsReportComparisonQuery | undefined,
): ExaminationsReportComparisonQuery | undefined {
  return normalizeReportComparisonQuery(input);
}

/** True when any comparison SQL slice should run. */
export function examinationsReportComparisonQueryActive(
  query: ExaminationsReportComparisonQuery | undefined,
): boolean {
  return reportComparisonQueryActive(query);
}
