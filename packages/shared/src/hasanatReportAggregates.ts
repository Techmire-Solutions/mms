import { z } from "zod";

export const hasanatReportComparisonSessionSchema = z.object({
  sessionId: z.string(),
  hasanat: z.number().nonnegative(),
});

export const hasanatReportComparisonMonthSchema = z.object({
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  points: z.number().nonnegative(),
});

export const hasanatReportComparisonSchema = z.object({
  sessions: z.array(hasanatReportComparisonSessionSchema),
  monthly: z.object({
    a: z.array(hasanatReportComparisonMonthSchema),
    b: z.array(hasanatReportComparisonMonthSchema),
  }),
});

/** ComparisonMode hasanat aggregates (optional comparison slice). */
export const hasanatReportAggregatesSchema = z.object({
  comparison: hasanatReportComparisonSchema.optional(),
});

export type HasanatReportComparisonSession = z.infer<typeof hasanatReportComparisonSessionSchema>;
export type HasanatReportComparisonMonth = z.infer<typeof hasanatReportComparisonMonthSchema>;
export type HasanatReportComparison = z.infer<typeof hasanatReportComparisonSchema>;
export type HasanatReportAggregates = z.infer<typeof hasanatReportAggregatesSchema>;

import {
  type BaseReportComparisonQuery,
  normalizeReportComparisonQuery,
  reportComparisonQueryActive,
} from "./reportComparisonQuery.js";

/** Optional ComparisonMode params for GET /hasanat/report-aggregates. */
export type HasanatReportComparisonQuery = BaseReportComparisonQuery;

export const EMPTY_HASANAT_REPORT_COMPARISON: HasanatReportComparison = {
  sessions: [],
  monthly: { a: [], b: [] },
};

export const EMPTY_HASANAT_REPORT_AGGREGATES: HasanatReportAggregates = {};

/**
 * Normalize ComparisonMode query params (max 2 sessionIds; ISO date ranges).
 */
export function normalizeHasanatReportComparisonQuery(
  input: HasanatReportComparisonQuery | undefined,
): HasanatReportComparisonQuery | undefined {
  return normalizeReportComparisonQuery(input);
}

/** True when any comparison SQL slice should run. */
export function hasanatReportComparisonQueryActive(
  query: HasanatReportComparisonQuery | undefined,
): boolean {
  return reportComparisonQueryActive(query);
}
