import { z } from "zod";
import { monthKeySchema } from "../core/monthKeySchema.js";

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

export const questionBankCategoryBreakdownItemSchema = z.object({
  categoryId: z.string(),
  categoryName: z.string(),
  questionCount: z.number().int().nonnegative(),
});

export const questionBankDifficultyBreakdownItemSchema = z.object({
  difficulty: z.enum(["easy", "medium", "hard", "unset"]),
  questionCount: z.number().int().nonnegative(),
});

export const questionBankMonthlyResultItemSchema = z.object({
  monthKey: monthKeySchema,
  resultsCount: z.number().int().nonnegative(),
  averageScore: z.number().nonnegative(),
});

// ---------------------------------------------------------------------------
// Root aggregate schema
// ---------------------------------------------------------------------------

export const questionBankReportAggregatesSchema = z.object({
  totalQuestions: z.number().int().nonnegative(),
  totalTests: z.number().int().nonnegative(),
  totalResults: z.number().int().nonnegative(),
  averageScore: z.number().nonnegative(),
  passRate: z.number().nonnegative(),
  categoryBreakdown: z.array(questionBankCategoryBreakdownItemSchema),
  difficultyBreakdown: z.array(questionBankDifficultyBreakdownItemSchema),
  monthlyResults: z.array(questionBankMonthlyResultItemSchema),
});

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type QuestionBankCategoryBreakdownItem = z.infer<
  typeof questionBankCategoryBreakdownItemSchema
>;
export type QuestionBankDifficultyBreakdownItem = z.infer<
  typeof questionBankDifficultyBreakdownItemSchema
>;
export type QuestionBankMonthlyResultItem = z.infer<typeof questionBankMonthlyResultItemSchema>;
export type QuestionBankReportAggregates = z.infer<typeof questionBankReportAggregatesSchema>;

/** Optional query params for GET /question-bank/report-aggregates. */
export const questionBankReportQuerySchema = z.object({
  dateFrom: z.string().max(32).optional(),
  dateTo: z.string().max(32).optional(),
  categoryId: z.string().max(64).optional(),
});

export type QuestionBankReportQuery = z.infer<typeof questionBankReportQuerySchema>;

// ---------------------------------------------------------------------------
// Empty sentinel
// ---------------------------------------------------------------------------

export const EMPTY_QB_REPORT_AGGREGATES: QuestionBankReportAggregates = {
  totalQuestions: 0,
  totalTests: 0,
  totalResults: 0,
  averageScore: 0,
  passRate: 0,
  categoryBreakdown: [],
  difficultyBreakdown: [],
  monthlyResults: [],
};
