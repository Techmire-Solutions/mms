import { z } from "zod";

export const accountingFinancialStatementItemSchema = z.object({
  code: z.string(),
  name: z.string(),
  type: z.string(),
  amount: z.number(),
  section: z.string().optional(),
});

export type AccountingFinancialStatementItem = z.infer<
  typeof accountingFinancialStatementItemSchema
>;

/** Per-account debit/credit totals with a normal-side `balance`. */
export const accountingTrialBalanceRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  type: z.string(),
  totalDebit: z.number(),
  totalCredit: z.number(),
  balance: z.number(),
});

export type AccountingTrialBalanceRow = z.infer<typeof accountingTrialBalanceRowSchema>;

/**
 * Indirect-method cash-flow adjustments, derived server-side from account
 * classification (the configured AR account, plus payable/depreciation accounts
 * identified by subtype or name) instead of hard-coded chart-of-accounts codes.
 */
export const accountingCashFlowAdjustmentsSchema = z.object({
  depreciation: z.number().default(0),
  receivables: z.number().default(0),
  payables: z.number().default(0),
});

export type AccountingCashFlowAdjustments = z.infer<typeof accountingCashFlowAdjustmentsSchema>;

/**
 * Accounting report aggregates.
 *
 * Two different period semantics live on this object, and conflating them is a
 * correctness bug rather than a style choice:
 *
 * - **Flow figures** (`revenue`, `expenses`, `netSurplus`, `cashInflow`,
 *   `cashOutflow`, `netCashFlow`, `incomeStatementTrialBalance`) cover the requested
 *   `[dateFrom, dateTo]` window, excluding closing journals.
 * - **Stock figures** (`assets`, `liabilities`, `equity`,
 *   `balanceSheetTrialBalance`) are cumulative through `dateTo`, ignoring
 *   `dateFrom` — a Balance Sheet reports balances, so an asset acquired before
 *   the window must still appear. Equity includes unclosed P&L as of `dateTo`.
 */
export const accountingReportAggregatesSchema = z.object({
  revenue: z.number().default(0),
  expenses: z.number().default(0),
  netSurplus: z.number().default(0),
  /** Cumulative asset balances as of `dateTo`. */
  assets: z.number().default(0),
  /** Cumulative liability balances as of `dateTo`. */
  liabilities: z.number().default(0),
  /** Cumulative equity (incl. unclosed `netSurplus`) as of `dateTo`. */
  equity: z.number().default(0),
  cashInflow: z.number().default(0),
  cashOutflow: z.number().default(0),
  /** Direct-method net movement on cash/bank accounts within the window. */
  netCashFlow: z.number().default(0),
  /** Indirect-method total: `netSurplus` plus `cashFlowAdjustments`. */
  netCashFlowIndirect: z.number().default(0),
  cashFlowAdjustments: accountingCashFlowAdjustmentsSchema.default({
    depreciation: 0,
    receivables: 0,
    payables: 0,
  }),
  /** Range-based ledger rows, including closing journals (Trial Balance). */
  trialBalance: z.array(accountingTrialBalanceRowSchema).default([]),
  /** Range-based rows excluding closing journals (Income Statement + exports). */
  incomeStatementTrialBalance: z.array(accountingTrialBalanceRowSchema).optional(),
  /** Cumulative Asset/Liability/Equity rows as of `dateTo` (Balance Sheet). */
  balanceSheetTrialBalance: z.array(accountingTrialBalanceRowSchema).default([]),
  comparison: z
    .object({
      revenue: z
        .object({
          a: z.number().default(0),
          b: z.number().default(0),
          deltaPct: z.number().default(0),
        })
        .optional(),
      expenses: z
        .object({
          a: z.number().default(0),
          b: z.number().default(0),
          deltaPct: z.number().default(0),
        })
        .optional(),
      netSurplus: z
        .object({
          a: z.number().default(0),
          b: z.number().default(0),
          deltaPct: z.number().default(0),
        })
        .optional(),
    })
    .optional(),
});

export type AccountingReportAggregates = z.infer<typeof accountingReportAggregatesSchema>;

export const accountingReportQuerySchema = z.object({
  dateFrom: z.string().max(32).optional(),
  dateTo: z.string().max(32).optional(),
});

export type AccountingReportQuery = z.infer<typeof accountingReportQuerySchema>;

export const EMPTY_ACCOUNTING_REPORT_AGGREGATES: AccountingReportAggregates = {
  revenue: 0,
  expenses: 0,
  netSurplus: 0,
  assets: 0,
  liabilities: 0,
  equity: 0,
  cashInflow: 0,
  cashOutflow: 0,
  netCashFlow: 0,
  netCashFlowIndirect: 0,
  cashFlowAdjustments: { depreciation: 0, receivables: 0, payables: 0 },
  trialBalance: [],
  balanceSheetTrialBalance: [],
};
