import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  hedgeReclassificationRequestSchema,
  hedgeRelationshipCreateSchema,
  hedgeSettlementRequestSchema,
  hedgeValuationRequestSchema,
} from "../finance/accountingHedgeSchemas.js";

const c = initContract();

const ok = z.unknown();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();
const idParams = z.object({ id: z.string() });

/**
 * IFRS 9 FX forward hedges. Served by the plain Fastify plugin
 * `accountingHedgeRoutes`; responses stay `unknown` (ADR-010).
 */
export const accountingHedgesContract = c.router({
  listHedges: {
    method: "GET",
    path: "/api/accounting/hedges",
    responses: { 200: ok, 403: errorResponse },
    summary: "Hedge relationships with their valuation history",
  },
  createHedge: {
    method: "POST",
    path: "/api/accounting/hedges",
    body: hedgeRelationshipCreateSchema,
    responses: { 201: ok, 400: errorResponse, 403: errorResponse, 422: errorResponse },
    summary: "Designate an FX forward hedge relationship",
  },
  previewHedgeValuation: {
    method: "POST",
    path: "/api/accounting/hedges/:id/valuations/preview",
    pathParams: idParams,
    body: hedgeValuationRequestSchema,
    responses: { 200: ok, 403: errorResponse, 404: errorResponse, 422: errorResponse },
    summary: "Fair value and OCI / P&L split at the closing rate",
  },
  postHedgeValuation: {
    method: "POST",
    path: "/api/accounting/hedges/:id/valuations",
    pathParams: idParams,
    body: hedgeValuationRequestSchema,
    responses: { 201: ok, 403: errorResponse, 404: errorResponse, 422: errorResponse },
    summary: "Post the valuation with an automatic next-day reversal",
  },
  settleHedge: {
    method: "POST",
    path: "/api/accounting/hedges/:id/settle",
    pathParams: idParams,
    body: hedgeSettlementRequestSchema,
    responses: { 201: ok, 403: errorResponse, 404: errorResponse, 422: errorResponse },
    summary: "Settle the forward in cash",
  },
  reclassifyHedge: {
    method: "POST",
    path: "/api/accounting/hedges/:id/reclassify",
    pathParams: idParams,
    body: hedgeReclassificationRequestSchema,
    responses: { 201: ok, 403: errorResponse, 404: errorResponse, 422: errorResponse },
    summary: "Reclassify the cash flow hedge reserve into profit or loss",
  },
});
