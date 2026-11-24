/**
 * IAS 21 lack of exchangeability (amendment effective 1 January 2025): a
 * currency that cannot be exchanged into another for a normal administrative
 * delay through a market with enforceable rights is translated at an estimated
 * spot rate, and the entity discloses how it estimated it (IAS 21.57A).
 */
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import { currencyCodeSchema } from "../money/moneySchemas.js";

export const currencyExchangeabilitySchema = z
  .object({
    currency: currencyCodeSchema,
    /** Date the currency was assessed as not exchangeable. */
    assessedOn: isoDateSchema,
    /** Approach used to estimate the spot rate (observable rate, adjusted rate, other technique). */
    estimationMethod: z.string().trim().min(10, "accounting.validation.estimationMethod").max(2000),
    /** Nature of the restriction and the risks it creates. */
    reason: z.string().trim().max(2000).default(""),
    updatedAt: z.string().optional(),
  })
  .strict();

export type CurrencyExchangeability = z.infer<typeof currencyExchangeabilitySchema>;

/** Body of `PUT /api/accounting/currency-exchangeability`: the full non-exchangeable list. */
export const currencyExchangeabilityPutSchema = z
  .object({
    currencies: z.array(currencyExchangeabilitySchema.omit({ updatedAt: true })).max(50),
  })
  .strict()
  .refine(
    (body) => new Set(body.currencies.map((row) => row.currency)).size === body.currencies.length,
    { message: "accounting.validation.duplicateCurrency", path: ["currencies"] },
  );

export type CurrencyExchangeabilityPut = z.infer<typeof currencyExchangeabilityPutSchema>;

/** Rate source recorded for an estimated spot rate of a non-exchangeable currency. */
export const ESTIMATED_RATE_SOURCE = "estimate";
