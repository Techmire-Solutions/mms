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

export const examinationsReportSubjectPassRateSchema = z.object({
  subject: z.string(),
  total: z.number().nonnegative(),
  passed: z.number().nonnegative(),
  passRatePct: z.number().nonnegative().max(100),
});

export const examinationsReportGradeBucketSchema = z.object({
  grade: z.string(),
  count: z.number().nonnegative(),
});

export const examinationsReportTopPerformerSchema = z.object({
  studentId: z.string(),
  averagePct: z.number().nonnegative().max(100),
  exams: z.number().nonnegative(),
});

/** Class/section averages (the section name is the class the roster is enrolled in). */
export const examinationsReportSectionAverageSchema = z.object({
  label: z.string(),
  total: z.number().nonnegative(),
  averagePct: z.number().nonnegative().max(100),
});

/**
 * Always-computed analytics (not tied to ComparisonMode): subject pass/fail, grade distribution,
 * top performers and section averages. These were previously computed in the browser from a capped
 * marks page, which silently truncated at 10,000 rows.
 */
export const examinationsReportAnalyticsSchema = z.object({
  subjectPassRates: z.array(examinationsReportSubjectPassRateSchema),
  gradeDistribution: z.array(examinationsReportGradeBucketSchema),
  topPerformers: z.array(examinationsReportTopPerformerSchema),
  sectionAverages: z.array(examinationsReportSectionAverageSchema),
});

/** ComparisonMode examinations aggregates (optional comparison slice). */
export const examinationsReportAggregatesSchema = z.object({
  comparison: examinationsReportComparisonSchema.optional(),
  analytics: examinationsReportAnalyticsSchema.optional(),
});

export type ExaminationsReportComparisonSession = z.infer<
  typeof examinationsReportComparisonSessionSchema
>;
export type ExaminationsReportComparisonMonth = z.infer<
  typeof examinationsReportComparisonMonthSchema
>;
export type ExaminationsReportComparison = z.infer<typeof examinationsReportComparisonSchema>;
export type ExaminationsReportAggregates = z.infer<typeof examinationsReportAggregatesSchema>;
export type ExaminationsReportAnalytics = z.infer<typeof examinationsReportAnalyticsSchema>;

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
