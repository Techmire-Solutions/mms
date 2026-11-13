/** IFRS 9 hedge relationship, valuation and settlement DTOs for `/api/accounting/hedges*`. */
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { LIST_PAGE_MAX_LIMIT } from "../core/apiSchemas.js";
import {
  currencyCodeSchema,
  exchangeRateValueSchema,
  moneyDecimalAmountSchema,
  refineMoneyForCurrency,
} from "../money/moneySchemas.js";

export const HEDGE_TYPES = ["cash_flow", "fair_value"] as const;
export const HEDGE_DIRECTIONS = ["buy", "sell"] as const;
export const HEDGE_STATUSES = ["active", "settled", "reclassified", "discontinued"] as const;

export type HedgeType = (typeof HEDGE_TYPES)[number];
export type HedgeStatus = (typeof HEDGE_STATUSES)[number];

const accountId = z.string().trim().min(1, "accounting.validation.accountRequired");

/**
 * Designation fields, before the cross-field refinements. Exported so the record
 * schema (the HTTP response shape) can extend the same fields instead of keeping
 * a second copy that drifts from what designation accepts.
 */
export const hedgeRelationshipFieldsSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    hedgeType: z.enum(HEDGE_TYPES),
    /** Bought (buy) or sold (sell) foreign currency forward. */
    direction: z.enum(HEDGE_DIRECTIONS),
    currency: currencyCodeSchema,
    notional: moneyDecimalAmountSchema.refine(
      (value) => Number(value) > 0,
      "accounting.validation.hedgeNotional",
    ),
    contractRate: exchangeRateValueSchema,
    /** Market forward rate for the maturity on the designation date (prices the hypothetical derivative). */
    designationRate: exchangeRateValueSchema,
    designationDate: isoDateSchema,
    maturityDate: isoDateSchema,
    hedgedItem: z.string().trim().min(3).max(500),
    riskManagementObjective: z
      .string()
      .trim()
      .min(10, "accounting.validation.hedgeObjective")
      .max(2000),
    instrumentAccountId: accountId,
    reserveAccountId: accountId.nullable(),
    pnlAccountId: accountId,
  })
  .strict();

/** Body of `POST /api/accounting/hedges` — designation and documentation (IFRS 9.6.4.1(b)). */
export const hedgeRelationshipCreateSchema = hedgeRelationshipFieldsSchema
  .refine((hedge) => hedge.maturityDate > hedge.designationDate, {
    message: "accounting.validation.hedgeMaturity",
    path: ["maturityDate"],
  })
  .refine((hedge) => hedge.hedgeType !== "cash_flow" || hedge.reserveAccountId, {
    message: "accounting.validation.hedgeReserveAccount",
    path: ["reserveAccountId"],
  })
  // The notional is the foreign amount that gets measured at every valuation.
  // Four decimals are accepted by `moneyDecimalAmountSchema` for storage, but a
  // value with more decimals than the hedged currency has cannot be represented
  // as money: it used to pass designation and then throw on the first valuation.
  .superRefine((hedge, ctx) =>
    refineMoneyForCurrency(hedge.notional, hedge.currency, ctx, ["notional"]),
  );

export type HedgeRelationshipCreate = z.infer<typeof hedgeRelationshipCreateSchema>;

/**
 * The computed effectiveness split, shared by the preview and the stored record.
 *
 * The record schemas live here (next to the designation fields they extend) so the
 * HTTP types are inferred from them; a manual interface mirroring the schema used to
 * drift silently because `sendValidated` accepts an `unknown` payload.
 */
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
    kind: z.enum(["valuation", "settlement", "reclassification", "discontinuation"]),
    entryId: z.string().nullable(),
    reversalEntryId: z.string().nullable(),
  })
  .strict();

export type HedgeValuationRecord = z.infer<typeof hedgeValuationRecordSchema>;

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

export type HedgeRelationship = z.infer<typeof hedgeRelationshipRecordSchema>;

/**
 * Query of `GET /api/accounting/hedges`. The list was previously unpaged (the
 * repository hard-capped it at 200 with no way to tell a full page from the whole
 * set); `limit` bounds the page and the response reports `truncated`.
 */
export const hedgeListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(LIST_PAGE_MAX_LIMIT).optional(),
  })
  .strict();

/** Body of `POST /api/accounting/hedges/:id/valuations[/preview]`. */
export const hedgeValuationRequestSchema = z.object({ valuationDate: isoDateSchema }).strict();

/** Body of `POST /api/accounting/hedges/:id/settle`. */
export const hedgeSettlementRequestSchema = z
  .object({
    settlementDate: isoDateSchema,
    settlementRate: exchangeRateValueSchema,
    cashAccountId: accountId,
  })
  .strict();

/**
 * Body of `POST /api/accounting/hedges/:id/discontinue` — IFRS 9.6.5.6: hedge
 * accounting stops prospectively, the cumulative effective amount stays in OCI until
 * it is reclassified.
 */
export const hedgeDiscontinuationRequestSchema = z
  .object({
    date: isoDateSchema,
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export type HedgeDiscontinuationRequest = z.infer<typeof hedgeDiscontinuationRequestSchema>;

/** Body of `POST /api/accounting/hedges/:id/reclassify`. */
export const hedgeReclassificationRequestSchema = z
  .object({ date: isoDateSchema, targetAccountId: accountId })
  .strict();
