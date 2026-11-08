import { z } from "zod";
import { monthKeySchema } from "../core/monthKeySchema.js";

/** Cumulative month-end enrollment headcount — `monthKey` is YYYY-MM. */
export const enrollmentsCumulativeTrendSchema = z.object({
  monthKey: monthKeySchema,
  students: z.number().int().nonnegative(),
});

export const enrollmentsReportStatusCountsSchema = z.object({
  pending: z.number().int().nonnegative(),
  confirmed: z.number().int().nonnegative(),
  cancelled: z.number().int().nonnegative(),
  completed: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
});

export const enrollmentsReportFeesSchema = z.object({
  due: z.number().nonnegative(),
  paid: z.number().nonnegative(),
});

export const enrollmentsReportBySessionItemSchema = z.object({
  sessionId: z.string(),
  name: z.string(),
  count: z.number().int().nonnegative(),
  revenue: z.number().nonnegative(),
});

export const enrollmentsReportComparisonSessionSchema = z.object({
  sessionId: z.string(),
  enrollmentCount: z.number().int().nonnegative(),
  studentIds: z.array(z.string()),
});

export const enrollmentsReportComparisonMonthSchema = z.object({
  monthKey: monthKeySchema,
  count: z.number().int().nonnegative(),
});

export const enrollmentsReportComparisonSchema = z.object({
  sessions: z.array(enrollmentsReportComparisonSessionSchema),
  monthly: z.object({
    a: z.array(enrollmentsReportComparisonMonthSchema),
    b: z.array(enrollmentsReportComparisonMonthSchema),
  }),
});

export const enrollmentsClassFillRateSchema = z.object({
  sessionId: z.string(),
  classId: z.string(),
  className: z.string(),
  /** Active-section capacity when the class has sections; otherwise the class capacity. 0 = unlimited. */
  capacity: z.number().int(),
  enrolled: z.number().int(),
  /** Null when capacity is 0 (unlimited). */
  fillPct: z.number().nullable(),
  seatsLeft: z.number().int().nullable(),
  /** Waitlisted applications for this class. */
  waitlisted: z.number().int(),
  /** Unmet demand: waitlisted applicants beyond the free seats (>= 0). */
  demand: z.number().int(),
});

export const enrollmentsRetentionSchema = z.object({
  /** Enrollments started in the trailing 12 months. */
  started: z.number().int(),
  dropped: z.number().int(),
  completed: z.number().int(),
  dropPct: z.number(),
  retentionPct: z.number(),
});

export const enrollmentsReportAggregatesSchema = z.object({
  cumulativeTrends: z.array(enrollmentsCumulativeTrendSchema),
  statusCounts: enrollmentsReportStatusCountsSchema,
  fees: enrollmentsReportFeesSchema,
  bySession: z.array(enrollmentsReportBySessionItemSchema),
  comparison: enrollmentsReportComparisonSchema.optional(),
  /** Per-class occupancy/seat demand (top 100 classes). */
  classFillRates: z.array(enrollmentsClassFillRateSchema).optional(),
  /** Trailing-12-month retention/drop summary. */
  retention: enrollmentsRetentionSchema.optional(),
});

export type EnrollmentsCumulativeTrend = z.infer<typeof enrollmentsCumulativeTrendSchema>;
export type EnrollmentsReportStatusCounts = z.infer<typeof enrollmentsReportStatusCountsSchema>;
export type EnrollmentsReportFees = z.infer<typeof enrollmentsReportFeesSchema>;
export type EnrollmentsReportBySessionItem = z.infer<typeof enrollmentsReportBySessionItemSchema>;
export type EnrollmentsReportComparisonSession = z.infer<
  typeof enrollmentsReportComparisonSessionSchema
>;
export type EnrollmentsReportComparisonMonth = z.infer<
  typeof enrollmentsReportComparisonMonthSchema
>;
export type EnrollmentsReportComparison = z.infer<typeof enrollmentsReportComparisonSchema>;
export type EnrollmentsReportAggregates = z.infer<typeof enrollmentsReportAggregatesSchema>;

import {
  type BaseReportComparisonQuery,
  normalizeReportComparisonQuery,
  reportComparisonQueryActive,
} from "../reports/reportComparisonQuery.js";
import { enrollmentHoldsSeat } from "./enrollmentsModuleManifest.js";

/** Optional ComparisonMode params for GET /report-aggregates. */
export type EnrollmentsReportComparisonQuery = BaseReportComparisonQuery;

/** Minimal row shape for pure EnrollmentReports panel compute. */
export type EnrollmentReportPanelRow = {
  sessionId: string;
  sessionName: string;
  status: string;
  paymentStatus: string;
  finalFee: number;
};

export const EMPTY_ENROLLMENTS_REPORT_COMPARISON: EnrollmentsReportComparison = {
  sessions: [],
  monthly: { a: [], b: [] },
};

export const EMPTY_ENROLLMENTS_REPORT_AGGREGATES: EnrollmentsReportAggregates = {
  cumulativeTrends: [],
  statusCounts: { pending: 0, confirmed: 0, cancelled: 0, completed: 0, total: 0 },
  fees: { due: 0, paid: 0 },
  bySession: [],
  classFillRates: [],
  retention: { started: 0, dropped: 0, completed: 0, dropPct: 0, retentionPct: 0 },
};

/**
 * Normalize ComparisonMode query params (max 2 sessionIds; ISO date ranges).
 */
export function normalizeEnrollmentsReportComparisonQuery(
  input: EnrollmentsReportComparisonQuery | undefined,
): EnrollmentsReportComparisonQuery | undefined {
  return normalizeReportComparisonQuery(input);
}

/** True when any comparison SQL slice should run. */
export function enrollmentsReportComparisonQueryActive(
  query: EnrollmentsReportComparisonQuery | undefined,
): boolean {
  return reportComparisonQueryActive(query);
}

/**
 * Pure cumulative month-end headcount for the last `monthCount` months
 * (EnrollmentChart SSOT — enrolledDate string ≤ YYYY-MM-31).
 */
export function computeEnrollmentsCumulativeTrends(
  enrolledDates: readonly string[],
  monthCount = 12,
  now: Date = new Date(),
): EnrollmentsCumulativeTrend[] {
  const validDates: string[] = [];
  for (let i = 0; i < enrolledDates.length; i++) {
    const trimmed = enrolledDates[i]?.trim();
    if (trimmed && /^\d{4}/.test(trimmed)) {
      validDates.push(trimmed);
    }
  }
  validDates.sort();

  const trends: EnrollmentsCumulativeTrend[] = [];
  let dateIndex = 0;
  const validLen = validDates.length;

  for (let offset = monthCount - 1; offset >= 0; offset--) {
    const cursor = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const year = cursor.getFullYear();
    const monthNum = String(cursor.getMonth() + 1).padStart(2, "0");
    const monthKey = `${year}-${monthNum}`;
    const cutoff = `${monthKey}-31`;

    while (dateIndex < validLen && validDates[dateIndex] <= cutoff) {
      dateIndex++;
    }
    trends.push({ monthKey, students: dateIndex });
  }

  return trends;
}

/**
 * Pure KPI / chart / by-session panels for EnrollmentReports
 * (mirrors prior FE client reductions over active enrollments).
 */
export function computeEnrollmentsReportPanels(
  enrollments: readonly EnrollmentReportPanelRow[],
): Pick<EnrollmentsReportAggregates, "statusCounts" | "fees" | "bySession"> {
  const statusCounts: EnrollmentsReportStatusCounts = {
    pending: 0,
    confirmed: 0,
    cancelled: 0,
    completed: 0,
    total: enrollments.length,
  };
  let due = 0;
  let paid = 0;
  const sessionStatsById: Record<string, EnrollmentsReportBySessionItem> = {};

  for (const enrollment of enrollments) {
    const status = String(enrollment.status || "");
    if (status === "pending") statusCounts.pending += 1;
    else if (status === "confirmed") statusCounts.confirmed += 1;
    else if (status === "cancelled") statusCounts.cancelled += 1;
    else if (status === "completed") statusCounts.completed += 1;

    const fee = Number(enrollment.finalFee) || 0;
    if (enrollmentHoldsSeat(status)) due += fee;
    if (enrollment.paymentStatus === "paid") paid += fee;

    const sessionId = enrollment.sessionId || "";
    if (!sessionStatsById[sessionId]) {
      sessionStatsById[sessionId] = {
        sessionId,
        name: enrollment.sessionName || "",
        count: 0,
        revenue: 0,
      };
    }
    sessionStatsById[sessionId].count += 1;
    if (enrollmentHoldsSeat(status)) {
      sessionStatsById[sessionId].revenue += fee;
    }
  }

  const bySession = Object.values(sessionStatsById).sort((left, right) => right.count - left.count);

  return {
    statusCounts,
    fees: { due, paid },
    bySession,
  };
}
