/**
 * IAS 21 currency settings and exchange-rate DTOs for the accounting module.
 */
import { z } from "zod";
import { isoDateSchema } from "../core/isoDateSchema.js";
import {
  currencyCodeSchema,
  exchangeRateTypeSchema,
  exchangeRateValueSchema,
} from "../money/moneySchemas.js";
import { isSupportedFunctionalCurrency } from "./accountingFxLines.js";

export const accountingCurrencySettingsSchema = z
  .object({
    functionalCurrency: currencyCodeSchema,
    presentationCurrency: currencyCodeSchema,
    /** True once posted entries exist: the functional currency can no longer change. */
    locked: z.boolean(),
    /** Foreign currencies documents may use (the functional one is always allowed). */
    enabledCurrencies: z.array(currencyCodeSchema),
  })
  .strict();

export type AccountingCurrencySettings = z.infer<typeof accountingCurrencySettingsSchema>;

/** Body of `PUT /api/accounting/currency-settings`. */
export const accountingCurrencySettingsPutSchema = accountingCurrencySettingsSchema
  .omit({ locked: true })
  .extend({ enabledCurrencies: z.array(currencyCodeSchema).max(50) })
  .strict()
  .refine((value) => isSupportedFunctionalCurrency(value.functionalCurrency), {
    message: "accounting.validation.functionalCurrencyScale",
    path: ["functionalCurrency"],
  });

export type AccountingCurrencySettingsPut = z.infer<typeof accountingCurrencySettingsPutSchema>;

/** Where a rate came from: entered by a user, or a scheduled provider feed. */
export const EXCHANGE_RATE_SOURCES = ["manual", "feed"] as const;

export const exchangeRateRecordSchema = z
  .object({
    id: z.string(),
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
    rateDate: isoDateSchema,
    rateType: exchangeRateTypeSchema,
    /** Units of `toCurrency` per one unit of `fromCurrency`. */
    rate: exchangeRateValueSchema,
    source: z.string(),
    overrideReason: z.string(),
    createdAt: z.string().optional(),
    createdBy: z.string().nullable().optional(),
  })
  .strict();

export type ExchangeRateRecord = z.infer<typeof exchangeRateRecordSchema>;

export const exchangeRatePutItemSchema = z
  .object({
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
    rateDate: isoDateSchema,
    rateType: exchangeRateTypeSchema,
    rate: exchangeRateValueSchema,
    overrideReason: z.string().trim().max(500).optional(),
  })
  .strict()
  .refine((value) => value.fromCurrency !== value.toCurrency, {
    message: "accounting.validation.exchangeRateSameCurrency",
    path: ["toCurrency"],
  });

/** Body of `PUT /api/accounting/exchange-rates`: upsert by (from, to, date, type). */
export const exchangeRatePutBodySchema = z
  .object({ rates: z.array(exchangeRatePutItemSchema).min(1).max(500) })
  .strict();

export type ExchangeRatePutItem = z.infer<typeof exchangeRatePutItemSchema>;

export const exchangeRateListQuerySchema = z
  .object({
    fromCurrency: currencyCodeSchema.optional(),
    toCurrency: currencyCodeSchema.optional(),
    rateType: exchangeRateTypeSchema.optional(),
    dateFrom: isoDateSchema.optional(),
    dateTo: isoDateSchema.optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
  })
  .strict();

export type ExchangeRateListQuery = z.infer<typeof exchangeRateListQuerySchema>;

export const exchangeRateLookupQuerySchema = z
  .object({
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
    date: isoDateSchema,
    rateType: exchangeRateTypeSchema.default("SPOT"),
  })
  .strict();

export type ExchangeRateLookupQuery = z.infer<typeof exchangeRateLookupQuerySchema>;

/** The rate in force on a date: latest on or before it, tenant rates first. */
export const exchangeRateLookupResultSchema = z
  .object({
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
    rate: exchangeRateValueSchema,
    rateDate: isoDateSchema,
    rateType: exchangeRateTypeSchema,
    source: z.string(),
  })
  .strict();

export type ExchangeRateLookupResult = z.infer<typeof exchangeRateLookupResultSchema>;
