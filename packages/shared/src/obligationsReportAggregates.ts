import { z } from "zod";

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

/** Monthly collection trend — `monthKey` is YYYY-MM. */
export const obligationsMonthlyTrendItemSchema = z.object({
  monthKey: z.string().regex(/^\d{4}-\d{2}$/),
  count: z.number().int().nonnegative(),
  amount: z.number().nonnegative(),
});

export const obligationsTypeBreakdownItemSchema = z.object({
  typeId: z.string(),
  typeName: z.string(),
  count: z.number().int().nonnegative(),
  amount: z.number().nonnegative(),
});

export const obligationsWakalaSummaryItemSchema = z.object({
  wakalaTypeId: z.string(),
  wakalaTypeName: z.string(),
  count: z.number().int().nonnegative(),
  amount: z.number().nonnegative(),
});

export const obligationsRepSummaryItemSchema = z.object({
  repId: z.string(),
  repName: z.string(),
  count: z.number().int().nonnegative(),
  amount: z.number().nonnegative(),
});

// ---------------------------------------------------------------------------
// Root aggregate schema
// ---------------------------------------------------------------------------

export const obligationsReportAggregatesSchema = z.object({
  totalCollections: z.number().int().nonnegative(),
  totalAmount: z.number().nonnegative(),
  uniqueReps: z.number().int().nonnegative(),
  typeBreakdown: z.array(obligationsTypeBreakdownItemSchema),
  monthlyTrend: z.array(obligationsMonthlyTrendItemSchema),
  wakalaSummary: z.array(obligationsWakalaSummaryItemSchema),
  repSummary: z.array(obligationsRepSummaryItemSchema),
});

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type ObligationsMonthlyTrendItem = z.infer<typeof obligationsMonthlyTrendItemSchema>;
export type ObligationsTypeBreakdownItem = z.infer<typeof obligationsTypeBreakdownItemSchema>;
export type ObligationsWakalaSummaryItem = z.infer<typeof obligationsWakalaSummaryItemSchema>;
export type ObligationsRepSummaryItem = z.infer<typeof obligationsRepSummaryItemSchema>;
export type ObligationsReportAggregates = z.infer<typeof obligationsReportAggregatesSchema>;

/** Optional date-range query params for GET /obligations/report-aggregates. */
export const obligationsReportQuerySchema = z.object({
  dateFrom: z.string().max(32).optional(),
  dateTo: z.string().max(32).optional(),
  typeId: z.string().max(64).optional(),
  repId: z.string().max(64).optional(),
});

export type ObligationsReportQuery = z.infer<typeof obligationsReportQuerySchema>;

// ---------------------------------------------------------------------------
// Empty sentinel
// ---------------------------------------------------------------------------

export const EMPTY_OBLIGATIONS_REPORT_AGGREGATES: ObligationsReportAggregates = {
  totalCollections: 0,
  totalAmount: 0,
  uniqueReps: 0,
  typeBreakdown: [],
  monthlyTrend: [],
  wakalaSummary: [],
  repSummary: [],
};
