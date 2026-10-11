import { z } from "zod";
import { isoDateSchema } from "./isoDateSchema.js";
import { moneyAmountSchema, signedMoneyAmountSchema } from "./accountingLedgerInvariants.js";

export const postingRulesRecordSchema = z
  .object({
    arAccountId: z.string().nullable().optional(),
    cashAccountId: z.string().nullable().optional(),
    incomeAccountId: z.string().nullable().optional(),
    discountAccountId: z.string().nullable().optional(),
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
    openingBalance: z.number().default(0),
    closingBalance: z.number().default(0),
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
    openingBalance: z.number().optional().default(0),
    closingBalance: z.number().optional().default(0),
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
