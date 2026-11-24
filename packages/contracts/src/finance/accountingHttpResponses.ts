/**
 * Response envelopes for the Finance/Accounting HTTP surface.
 *
 * Route handlers build their payloads by hand and previously sent them without a
 * runtime schema, so a mapper that emitted a non-canonical decimal (e.g.
 * `"281.0000000000"`), an extra audit column, or a missing key looked exactly
 * like a correct response. These schemas are the declared contract for those
 * endpoints; `sendValidated` in the backend enforces them before the bytes leave
 * the process, and ts-rest enforces the contract routers' own response schemas.
 */
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { fiscalYearRecordSchema, journalEntryRecordSchema } from "./accountingModuleManifest.js";
import {
  accountListSchema,
  fiscalYearListSchema,
  journalEntryListSchema,
} from "./accountingRecordLists.js";
import {
  bankStatementRecordSchema,
  openingBalanceRecordSchema,
  postingPeriodRecordSchema,
  postingRulesRecordSchema,
} from "./accountingLedgerOps.js";
import { fxRevaluationRunSchema } from "./accountingFxRevaluation.js";
import { fxReportSchema } from "./accountingFxReport.js";
import { specializedEntryResultSchema } from "./accountingSpecializedEntries.js";
import {
  accountingCurrencySettingsSchema,
  exchangeRateLookupResultSchema,
  exchangeRateRecordSchema,
} from "./accountingFxSettings.js";
import { currencyExchangeabilitySchema } from "./accountingFxExchangeability.js";
import { voucherNumberingRecordSchema } from "./accountingVoucherNumbering.js";
import {
  hedgeRelationshipRecordSchema,
  hedgeValuationFiguresSchema,
  hedgeValuationRecordSchema,
} from "./accountingHedgeSchemas.js";

export { hedgeRelationshipRecordSchema, hedgeValuationFiguresSchema, hedgeValuationRecordSchema };
import { hyperinflationSettingsSchema, ias29RunSchema } from "./accountingHyperinflationSchemas.js";
import { priceIndexPointSchema } from "./accountingHyperinflation.js";

/** `GET`/`PUT /api/accounting/currency-settings`. */
export const accountingCurrencySettingsResponseSchema = z
  .object({ settings: accountingCurrencySettingsSchema })
  .strict();

/** `GET`/`PUT /api/accounting/currency-exchangeability`. */
export const accountingExchangeabilityResponseSchema = z
  .object({ currencies: z.array(currencyExchangeabilitySchema) })
  .strict();

/** `GET`/`PUT /api/accounting/exchange-rates`. */
export const accountingExchangeRatesResponseSchema = z
  .object({ rates: z.array(exchangeRateRecordSchema) })
  .strict();

/** `GET /api/accounting/exchange-rates/lookup` — a miss is a 404, never a null body. */
export const accountingExchangeRateLookupResponseSchema = z
  .object({ rate: exchangeRateLookupResultSchema })
  .strict();

/** `GET`/`PUT /api/accounting/voucher-numbering`. */
export const voucherNumberingResponseSchema = z
  .object({ numbering: voucherNumberingRecordSchema })
  .strict();

export const hedgeRelationshipResponseSchema = z
  .object({ hedge: hedgeRelationshipRecordSchema })
  .strict();

/**
 * `GET /api/accounting/hedges`. `truncated` is additive: it was introduced when
 * the list gained a `limit`, so a caller can tell a full page from the whole set.
 */
export const hedgeRelationshipListResponseSchema = z
  .object({
    hedges: z.array(hedgeRelationshipRecordSchema),
    truncated: z.boolean(),
  })
  .strict();

/**
 * `POST /api/accounting/hedges/:id/valuations/preview` — the preview returns a
 * full valuation record (the same figures the post endpoint would store, with
 * `entryId`/`reversalEntryId` still null), not the bare figures.
 */
export const hedgeValuationResponseSchema = z
  .object({ valuation: hedgeValuationRecordSchema })
  .strict();

/** `POST /api/accounting/entries/:id/reverse` — the reversing entry and its link to the original. */
export const journalReversalResultSchema = z
  .object({
    entry: journalEntryRecordSchema,
    original: z.object({ id: z.string().min(1), ref: z.string(), date: isoDateSchema }).strict(),
    priorPeriod: z.boolean(),
    executedAt: z.string(),
  })
  .strict();

/** `GET`/`PUT /api/accounting/hyperinflation-settings`. */
export const hyperinflationSettingsResponseSchema = z
  .object({ settings: hyperinflationSettingsSchema })
  .strict();

/** `GET`/`PUT /api/accounting/price-indices`. */
export const priceIndicesResponseSchema = z
  .object({ points: z.array(priceIndexPointSchema) })
  .strict();

/** `GET /api/accounting/ias29-restatements`. */
export const ias29RunsResponseSchema = z.object({ runs: z.array(ias29RunSchema) }).strict();

/** `POST /api/accounting/ias29-restatements[/preview]`. */
export const ias29RunResponseSchema = z.object({ run: ias29RunSchema }).strict();

/**
 * Ledger-ops responses (posting rules, fiscal-year close, posting periods,
 * opening balances, bank statements/reconciliation).
 *
 * The request schemas in `accountingLedgerOps.ts` were already strict; the
 * responses were hand-built and shipped unchecked, so a mapper that started
 * returning a raw cents integer or an extra audit column looked like a correct
 * response. `sendValidated` enforces these.
 */
export const postingRulesResponseSchema = z.object({ rules: postingRulesRecordSchema }).strict();
export const fiscalYearCloseResponseSchema = z
  .object({ fiscalYear: fiscalYearRecordSchema })
  .strict();
export const postingPeriodsResponseSchema = z
  .object({ periods: z.array(postingPeriodRecordSchema) })
  .strict();
export const postingPeriodResponseSchema = z.object({ period: postingPeriodRecordSchema }).strict();
export const openingBalancesResponseSchema = z
  .object({ balances: z.array(openingBalanceRecordSchema) })
  .strict();
/** `POST /opening-balances/:fiscalYearId/post` — `posted: false` means "already posted unchanged". */
export const openingBalancesPostedResponseSchema = z
  .object({ success: z.literal(true), posted: z.boolean() })
  .strict();
export const bankStatementsResponseSchema = z
  .object({ statements: z.array(bankStatementRecordSchema) })
  .strict();
export const bankStatementResponseSchema = z
  .object({ statement: bankStatementRecordSchema })
  .strict();
/** `POST /bank-reconciliations`. */
export const accountingSuccessResponseSchema = z.object({ success: z.literal(true) }).strict();

/** IAS 21 period-end revaluation history / preview / post (each reverses the next day). */
export const fxRevaluationRunsResponseSchema = z
  .object({ runs: z.array(fxRevaluationRunSchema) })
  .strict();
export const fxRevaluationRunResponseSchema = z.object({ run: fxRevaluationRunSchema }).strict();
/** `GET /api/accounting/fx-report` (IFRS 7.33–34 / IAS 21.52 disclosures). */
export const fxReportResponseSchema = z.object({ report: fxReportSchema }).strict();

/** `POST /api/accounting/specialized-entries` — the fee/salary entry that was written. */
export const specializedEntryResponseSchema = specializedEntryResultSchema;

/** `POST /api/accounting/accounts/seed-default` (409 when the chart is not empty). */
export const accountingSeedChartResponseSchema = z
  .object({
    success: z.literal(true),
    count: z.number().int().min(0),
    defaultsApplied: z.object({ retainedEarnings: z.boolean(), cashAccount: z.boolean() }).strict(),
  })
  .strict();

/** Chart-of-accounts archive / restore / bulk archive. */
export const accountArchiveResponseSchema = z
  .object({ success: z.literal(true), archived: z.boolean() })
  .strict();
export const accountRestoreResponseSchema = z
  .object({ success: z.literal(true), restored: z.boolean() })
  .strict();
/** `{ success, succeeded, failed }` bulk operation envelope (archive/delete/restore). */
export const accountingBulkResultResponseSchema = z
  .object({
    success: z.literal(true),
    succeeded: z.number().int().min(0),
    failed: z.number().int().min(0),
  })
  .strict();

/** Chart-of-accounts bulk archive (same envelope, named for the route). */
export const accountsBulkArchiveResponseSchema = accountingBulkResultResponseSchema;

/** Additive bulk-upsert envelopes (`PUT …/bulk` echoes the saved collection). */
export const accountsBulkUpsertResponseSchema = z.object({ accounts: accountListSchema }).strict();
export const entriesBulkUpsertResponseSchema = z
  .object({ entries: journalEntryListSchema })
  .strict();
export const fiscalYearsBulkUpsertResponseSchema = z
  .object({ fiscalYears: fiscalYearListSchema })
  .strict();
