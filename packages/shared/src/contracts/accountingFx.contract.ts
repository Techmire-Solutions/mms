import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  accountingCurrencySettingsPutSchema,
  exchangeRateListQuerySchema,
  exchangeRateLookupQuerySchema,
  exchangeRatePutBodySchema,
} from "../finance/accountingFxSettings.js";

const c = initContract();

const ok = z.unknown();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();

/**
 * IAS 21 currency settings and exchange rates. Served by the plain Fastify
 * plugin `accountingExchangeRateRoutes`; responses stay `unknown` (ADR-010).
 */
export const accountingFxContract = c.router({
  getCurrencySettings: {
    method: "GET",
    path: "/api/accounting/currency-settings",
    responses: { 200: ok, 403: errorResponse, 500: errorResponse },
    summary: "Get functional/presentation currency and enabled currencies",
  },
  putCurrencySettings: {
    method: "PUT",
    path: "/api/accounting/currency-settings",
    body: accountingCurrencySettingsPutSchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 409: errorResponse },
    summary: "Save currency settings (functional currency frozen once posted)",
  },
  listExchangeRates: {
    method: "GET",
    path: "/api/accounting/exchange-rates",
    query: exchangeRateListQuerySchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse },
    summary: "List tenant exchange rates, newest first",
  },
  putExchangeRates: {
    method: "PUT",
    path: "/api/accounting/exchange-rates",
    body: exchangeRatePutBodySchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse },
    summary: "Upsert exchange rates by (from, to, date, type)",
  },
  lookupExchangeRate: {
    method: "GET",
    path: "/api/accounting/exchange-rates/lookup",
    query: exchangeRateLookupQuerySchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 404: errorResponse },
    summary: "Rate in force on a date (latest on or before it)",
  },
});
