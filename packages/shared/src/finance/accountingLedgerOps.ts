import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { moneyAmountSchema, signedMoneyAmountSchema } from "./accountingLedgerInvariants.js";
import { POSTING_PERIOD_STATUSES } from "./accountingEnums.js";

export const postingRulesRecordSchema = z
  .object({
    arAccountId: z.string().nullable().optional(),
    cashAccountId: z.string().nullable().optional(),
    bankAccountId: z.string().nullable().optional(),
    incomeAccountId: z.string().nullable().optional(),
    discountAccountId: z.string().nullable().optional(),
    /** IAS 21: realized FX gain/loss on settlement (Revenue or Expense). */
    fxRealizedAccountId: z.string().nullable().optional(),
    /** IAS 21: unrealized FX gain/loss on period-end revaluation (Revenue or Expense). */
    fxUnrealizedAccountId: z.string().nullable().optional(),
    /** Absorbs sub-cent residue on multi-currency entries (Revenue or Expense). */
    fxRoundingAccountId: z.string().nullable().optional(),
    /** Foreign currency translation reserve (Equity / OCI). */
    ctaAccountId: z.string().nullable().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const postingRulesUpdateSchema = postingRulesRecordSchema.omit({ updatedAt: true }).strict();

export type PostingRules = z.infer<typeof postingRulesRecordSchema>;
export type PostingRulesUpdate = z.infer<typeof postingRulesUpdateSchema>;

/**
 * A single-sided opening-balance row. Both sides positive is rejected rather
 * than silently netted: the resulting journal line fails
 * `isJournalLineSingleSided`, which surfaced to the user as the unrelated
 * "Opening balances must form a balanced journal" error.
 */
const isSingleSidedOpeningBalance = (row: { debit: number; credit: number }): boolean =>
  !(row.debit > 0 && row.credit > 0);

export const openingBalanceRecordSchema = z
  .object({
    id: z.string(),
    fiscalYearId: z.string().min(1),
    accountId: z.string().min(1),
    debit: moneyAmountSchema.default(0),
    credit: moneyAmountSchema.default(0),
  })
  .strict();

export const openingBalanceInsertSchema = z
  .object({
    id: z.string().optional(),
    fiscalYearId: z.string().min(1),
    accountId: z.string().min(1),
    debit: moneyAmountSchema.default(0),
    credit: moneyAmountSchema.default(0),
  })
  .strict()
  .refine(isSingleSidedOpeningBalance, {
    message: "accounting.openingBalances.singleSided",
    path: ["debit"],
  });

export const openingBalancesReplaceSchema = z
  .object({
    fiscalYearId: z.string().min(1),
    balances: z.array(openingBalanceInsertSchema).max(500),
  })
  .strict();

export type OpeningBalance = z.infer<typeof openingBalanceRecordSchema>;
export type OpeningBalanceInsert = z.infer<typeof openingBalanceInsertSchema>;

export const bankStatementLineRecordSchema = z
  .object({
    id: z.string(),
    date: isoDateSchema,
    description: z.string().default(""),
    amount: signedMoneyAmountSchema,
  })
  .strict();

export const bankStatementLineInsertSchema = bankStatementLineRecordSchema
  .extend({ id: z.string().optional() })
  .strict();

export const bankStatementRecordSchema = z
  .object({
    id: z.string(),
    accountId: z.string().min(1),
    periodStart: isoDateSchema,
    periodEnd: isoDateSchema,
    openingBalance: signedMoneyAmountSchema.default(0),
    closingBalance: signedMoneyAmountSchema.default(0),
    lines: z.array(bankStatementLineRecordSchema).default([]),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export const bankStatementInsertSchema = z
  .object({
    id: z.string().optional(),
    accountId: z.string().min(1),
    periodStart: isoDateSchema,
    periodEnd: isoDateSchema,
    openingBalance: signedMoneyAmountSchema.optional().default(0),
    closingBalance: signedMoneyAmountSchema.optional().default(0),
    lines: z.array(bankStatementLineInsertSchema).optional().default([]),
  })
  .strict();

export type BankStatement = z.infer<typeof bankStatementRecordSchema>;
export type BankStatementInsert = z.infer<typeof bankStatementInsertSchema>;
export type BankStatementLine = z.infer<typeof bankStatementLineRecordSchema>;

export const bankReconciliationMatchSchema = z
  .object({
    statementLineId: z.string().min(1),
    journalEntryId: z.string().min(1),
    journalLineId: z.string().min(1),
  })
  .strict();

export type BankReconciliationMatch = z.infer<typeof bankReconciliationMatchSchema>;

/** One monthly posting period derived from a fiscal year (migration 0249 enforces it). */
export const postingPeriodRecordSchema = z
  .object({
    id: z.string(),
    fiscalYearId: z.string(),
    label: z.string(),
    startDate: isoDateSchema,
    endDate: isoDateSchema,
    status: z.enum(POSTING_PERIOD_STATUSES),
    closedAt: z.string().nullable().optional(),
    closedBy: z.string().nullable().optional(),
    updatedAt: z.string().optional(),
  })
  .strict();

export type PostingPeriod = z.infer<typeof postingPeriodRecordSchema>;

export const postingPeriodParamsSchema = z.object({ id: z.string().trim().min(1) }).strict();

export const postingPeriodsQuerySchema = z
  .object({ fiscalYearId: z.string().trim().min(1).optional() })
  .strict();

/** Optional reason recorded with a period lock (audit trail). */
export const closePostingPeriodBodySchema = z
  .object({ reason: z.string().trim().max(500).optional() })
  .strict();

export type ClosePostingPeriodBody = z.infer<typeof closePostingPeriodBodySchema>;

/** Optional justification recorded when a period lock is lifted (audit trail). */
export const reopenPostingPeriodBodySchema = z
  .object({ reason: z.string().trim().max(500).optional() })
  .strict();

export type ReopenPostingPeriodBody = z.infer<typeof reopenPostingPeriodBodySchema>;

export const closeFiscalYearBodySchema = z
  .object({
    retainedEarningsAccountId: z.string().min(1).optional(),
  })
  .strict();

export type CloseFiscalYearBody = z.infer<typeof closeFiscalYearBodySchema>;

export const openingBalancesQuerySchema = z
  .object({
    fiscalYearId: z.string().min(1),
  })
  .strict();

export type OpeningBalancesQuery = z.infer<typeof openingBalancesQuerySchema>;

export const fiscalYearParamsSchema = z
  .object({
    fiscalYearId: z.string().min(1),
  })
  .strict();

export type FiscalYearParams = z.infer<typeof fiscalYearParamsSchema>;
