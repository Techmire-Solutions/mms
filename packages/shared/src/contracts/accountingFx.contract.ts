import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { fxRevaluationRequestSchema } from "../finance/accountingFxRevaluation.js";
import { currencyExchangeabilityPutSchema } from "../finance/accountingFxExchangeability.js";
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
  listExchangeability: {
    method: "GET",
    path: "/api/accounting/currency-exchangeability",
    responses: { 200: ok, 403: errorResponse },
    summary: "Currencies assessed as not exchangeable (IAS 21)",
  },
  putExchangeability: {
    method: "PUT",
    path: "/api/accounting/currency-exchangeability",
    body: currencyExchangeabilityPutSchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse },
    summary: "Replace the non-exchangeable currency assessments",
  },
  listFxRevaluations: {
    method: "GET",
    path: "/api/accounting/fx-revaluations",
    responses: { 200: ok, 403: errorResponse },
    summary: "Posted period-end FX revaluations, newest first",
  },
  previewFxRevaluation: {
    method: "POST",
    path: "/api/accounting/fx-revaluations/preview",
    body: fxRevaluationRequestSchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 422: errorResponse },
    summary: "Compute unrealized FX at the closing rate without posting",
  },
  postFxRevaluation: {
    method: "POST",
    path: "/api/accounting/fx-revaluations",
    body: fxRevaluationRequestSchema,
    responses: { 201: ok, 400: errorResponse, 403: errorResponse, 422: errorResponse },
    summary: "Post the revaluation with an automatic next-day reversal",
  },
});
