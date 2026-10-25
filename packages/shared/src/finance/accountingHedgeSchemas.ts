/** IFRS 9 hedge relationship, valuation and settlement DTOs for `/api/accounting/hedges*`. */
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { currencyCodeSchema, exchangeRateValueSchema, moneyDecimalAmountSchema } from "../money/moneySchemas.js";

export const HEDGE_TYPES = ["cash_flow", "fair_value"] as const;
export const HEDGE_DIRECTIONS = ["buy", "sell"] as const;
export const HEDGE_STATUSES = ["active", "settled", "reclassified", "discontinued"] as const;

export type HedgeType = (typeof HEDGE_TYPES)[number];
export type HedgeStatus = (typeof HEDGE_STATUSES)[number];

const accountId = z.string().trim().min(1);

/** Body of `POST /api/accounting/hedges` — designation and documentation (IFRS 9.6.4.1(b)). */
export const hedgeRelationshipCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    hedgeType: z.enum(HEDGE_TYPES),
    /** Bought (buy) or sold (sell) foreign currency forward. */
    direction: z.enum(HEDGE_DIRECTIONS),
    currency: currencyCodeSchema,
    notional: moneyDecimalAmountSchema.refine((value) => Number(value) > 0, "accounting.validation.hedgeNotional"),
    contractRate: exchangeRateValueSchema,
    /** Market forward rate for the maturity on the designation date (prices the hypothetical derivative). */
    designationRate: exchangeRateValueSchema,
    designationDate: isoDateSchema,
    maturityDate: isoDateSchema,
    hedgedItem: z.string().trim().min(3).max(500),
    riskManagementObjective: z.string().trim().min(10, "accounting.validation.hedgeObjective").max(2000),
    instrumentAccountId: accountId,
    reserveAccountId: accountId.nullable(),
    pnlAccountId: accountId,
  })
  .strict()
  .refine((hedge) => hedge.maturityDate > hedge.designationDate, {
    message: "accounting.validation.hedgeMaturity",
    path: ["maturityDate"],
  })
  .refine((hedge) => hedge.hedgeType !== "cash_flow" || hedge.reserveAccountId, {
    message: "accounting.validation.hedgeReserveAccount",
    path: ["reserveAccountId"],
  });

export type HedgeRelationshipCreate = z.infer<typeof hedgeRelationshipCreateSchema>;

export interface HedgeValuationRecord {
  valuationDate: string;
  kind: "valuation" | "settlement" | "reclassification";
  rate: string;
  instrumentValue: string;
  hedgedChange: string;
  effective: string;
  ineffective: string;
  entryId: string | null;
  reversalEntryId: string | null;
}

export interface HedgeRelationship extends HedgeRelationshipCreate {
  id: string;
  status: HedgeStatus;
  /** Reserve balance left in OCI by the settlement, until it is reclassified. */
  settledReserve: string;
  valuations: HedgeValuationRecord[];
  createdAt?: string;
}

/** Body of `POST /api/accounting/hedges/:id/valuations[/preview]`. */
export const hedgeValuationRequestSchema = z.object({ valuationDate: isoDateSchema }).strict();

/** Body of `POST /api/accounting/hedges/:id/settle`. */
export const hedgeSettlementRequestSchema = z
  .object({ settlementDate: isoDateSchema, settlementRate: exchangeRateValueSchema, cashAccountId: accountId })
  .strict();

/** Body of `POST /api/accounting/hedges/:id/reclassify`. */
export const hedgeReclassificationRequestSchema = z
  .object({ date: isoDateSchema, targetAccountId: accountId })
  .strict();
