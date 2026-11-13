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
import { exchangeRateValueSchema, moneyDecimalAmountSchema } from "../money/moneySchemas.js";
import { journalEntryRecordSchema } from "./accountingModuleManifest.js";
import {
  accountingCurrencySettingsSchema,
  exchangeRateLookupResultSchema,
  exchangeRateRecordSchema,
} from "./accountingFxSettings.js";
import { currencyExchangeabilitySchema } from "./accountingFxExchangeability.js";
import { voucherNumberingRecordSchema } from "./accountingVoucherNumbering.js";
import {
  HEDGE_DIRECTIONS,
  HEDGE_STATUSES,
  HEDGE_TYPES,
  hedgeRelationshipFieldsSchema,
} from "./accountingHedgeSchemas.js";
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

/** The computed effectiveness split, shared by the preview and the stored record. */
export const hedgeValuationFiguresSchema = z
  .object({
    rate: exchangeRateValueSchema,
    instrumentValue: moneyDecimalAmountSchema,
    hedgedChange: moneyDecimalAmountSchema,
    effective: moneyDecimalAmountSchema,
    ineffective: moneyDecimalAmountSchema,
  })
  .strict();

/** One valuation, settlement or reclassification recorded against a hedge. */
export const hedgeValuationRecordSchema = hedgeValuationFiguresSchema
  .extend({
    valuationDate: isoDateSchema,
    kind: z.enum(["valuation", "settlement", "reclassification"]),
    entryId: z.string().nullable(),
    reversalEntryId: z.string().nullable(),
  })
  .strict();

/** `POST /api/accounting/hedges` and the mutation endpoints' `hedge` payload. */
export const hedgeRelationshipRecordSchema = hedgeRelationshipFieldsSchema
  .extend({
    id: z.string().min(1),
    status: z.enum(HEDGE_STATUSES),
    hedgeType: z.enum(HEDGE_TYPES),
    direction: z.enum(HEDGE_DIRECTIONS),
    /** Reserve left in OCI by the settlement, until it is reclassified. */
    settledReserve: moneyDecimalAmountSchema,
    valuations: z.array(hedgeValuationRecordSchema),
    createdAt: z.string().optional(),
  })
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
