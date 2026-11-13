/**
 * Dedicated Finance/Accounting report endpoints that must not be computed in the
 * browser: the General Ledger (exact running balance per account) and the
 * receivables aging report.
 */
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { LIST_PAGE_MAX_LIMIT } from "../core/apiSchemas.js";
import { moneyAmountSchema, signedMoneyAmountSchema } from "./accountingLedgerInvariants.js";
import { ACCOUNTING_ACCOUNT_TYPES } from "./accountingEnums.js";

/** One page of the General Ledger for a single account. */
export const accountingLedgerQuerySchema = z
  .object({
    accountId: z.string().trim().min(1),
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(LIST_PAGE_MAX_LIMIT).optional(),
  })
  .strict()
  .refine((query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo, {
    message: "accounting.validation.reportRange",
    path: ["dateTo"],
  });

export type AccountingLedgerQuery = z.infer<typeof accountingLedgerQuerySchema>;

export const accountingLedgerLineSchema = z
  .object({
    id: z.string(),
    entryId: z.string(),
    date: isoDateSchema,
    ref: z.string(),
    description: z.string(),
    lineDescription: z.string(),
    debit: moneyAmountSchema,
    credit: moneyAmountSchema,
    /** Debit − credit accumulated from the ledger start through this line. */
    running: signedMoneyAmountSchema,
  })
  .strict();

export const accountingLedgerAccountSchema = z
  .object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    type: z.enum(ACCOUNTING_ACCOUNT_TYPES),
    subtype: z.string(),
  })
  .strict();

export const accountingLedgerPageSchema = z
  .object({
    account: accountingLedgerAccountSchema,
    /** Debit − credit before the requested window (all time when `dateFrom` is omitted). */
    openingBalance: signedMoneyAmountSchema,
    lines: z.array(accountingLedgerLineSchema),
    /** Movement inside the whole requested window, not only this page. */
    totalDebit: moneyAmountSchema,
    totalCredit: moneyAmountSchema,
    closingBalance: signedMoneyAmountSchema,
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().min(0),
    hasMore: z.boolean(),
  })
  .strict();

export type AccountingLedgerPage = z.infer<typeof accountingLedgerPageSchema>;

/** Rows per aging page when the client does not ask for a size. */
export const RECEIVABLES_AGING_DEFAULT_LIMIT = 100;
/** Hard ceiling: each row is one student with open invoices. */
export const RECEIVABLES_AGING_MAX_LIMIT = 500;

/**
 * Query of `GET /api/accounting/receivables-aging`.
 *
 * It used to take `asOf` only while the loader capped the result at 500 rows and
 * still reported `hasMore`, so the remainder of a large aging report was
 * unreachable. `page`/`limit` make the flag actionable.
 */
export const receivablesAgingQuerySchema = z
  .object({
    asOf: isoDateSchema,
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(RECEIVABLES_AGING_MAX_LIMIT).optional(),
  })
  .strict();

export type ReceivablesAgingQuery = z.infer<typeof receivablesAgingQuerySchema>;

/** Buckets are days past due: current (not yet due), 1–30, 31–60, 61–90, 90+. */
export const receivablesAgingBucketSchema = z
  .object({
    current: moneyAmountSchema,
    d1_30: moneyAmountSchema,
    d31_60: moneyAmountSchema,
    d61_90: moneyAmountSchema,
    d90_plus: moneyAmountSchema,
    total: moneyAmountSchema,
  })
  .strict();

export const receivablesAgingRowSchema = receivablesAgingBucketSchema
  .extend({
    studentId: z.string(),
    studentName: z.string(),
    className: z.string(),
    sessionName: z.string(),
    invoiceCount: z.number().int().min(0),
  })
  .strict();

export const receivablesAgingSchema = z
  .object({
    asOf: isoDateSchema,
    rows: z.array(receivablesAgingRowSchema),
    totals: receivablesAgingBucketSchema.extend({
      invoiceCount: z.number().int().min(0),
    }),
    totalStudents: z.number().int().min(0),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    hasMore: z.boolean(),
  })
  .strict();

export type ReceivablesAgingRow = z.infer<typeof receivablesAgingRowSchema>;
export type ReceivablesAging = z.infer<typeof receivablesAgingSchema>;

/** Report kinds the server can render as a BiDi-correct Typst PDF. */
export const ACCOUNTING_REPORT_PDF_KINDS = ["trial-balance", "general-ledger"] as const;
export type AccountingReportPdfKind = (typeof ACCOUNTING_REPORT_PDF_KINDS)[number];

export const accountingReportPdfBodySchema = z
  .object({
    kind: z.enum(ACCOUNTING_REPORT_PDF_KINDS),
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
    /** Required for `general-ledger`; ignored for the trial balance. */
    accountId: z.string().trim().min(1).optional(),
    lang: z.enum(["ar", "ur", "fa", "en"]).optional(),
    direction: z.enum(["rtl", "ltr"]).optional(),
    filename: z.string().trim().max(120).optional(),
  })
  .strict()
  .refine((body) => body.kind !== "general-ledger" || Boolean(body.accountId), {
    message: "accounting.validation.accountRequired",
    path: ["accountId"],
  })
  .refine((body) => !body.dateFrom || !body.dateTo || body.dateFrom <= body.dateTo, {
    message: "accounting.validation.reportRange",
    path: ["dateTo"],
  });

export type AccountingReportPdfBody = z.infer<typeof accountingReportPdfBodySchema>;

/** Streamed journal-register (General Ledger) export request. */
export const accountingLedgerExportBodySchema = z
  .object({
    accountId: z.string().trim().min(1),
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
    lang: z.enum(["ar", "ur", "fa", "en"]).optional(),
    filename: z.string().trim().max(120).optional(),
  })
  .strict()
  .refine((body) => !body.dateFrom || !body.dateTo || body.dateFrom <= body.dateTo, {
    message: "accounting.validation.reportRange",
    path: ["dateTo"],
  });

export type AccountingLedgerExportBody = z.infer<typeof accountingLedgerExportBodySchema>;
