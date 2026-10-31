import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  consolidationGroupPutSchema,
  consolidationReportQuerySchema,
} from "../finance/consolidationGroups.js";

const c = initContract();

const ok = z.unknown();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();
const idParams = z.object({ id: z.string() });

/** Platform Console consolidation (IAS 21 translation + IFRS 10 aggregation); responses `unknown` (ADR-010). */
export const platformConsolidationContract = c.router({
  listGroups: {
    method: "GET",
    path: "/api/platform/consolidation/groups",
    responses: { 200: ok, 401: errorResponse, 403: errorResponse },
    summary: "List consolidation groups",
  },
  putGroup: {
    method: "PUT",
    path: "/api/platform/consolidation/groups/:id",
    pathParams: idParams,
    body: consolidationGroupPutSchema,
    responses: { 200: ok, 400: errorResponse, 403: errorResponse, 422: errorResponse },
    summary: "Create or replace a consolidation group",
  },
  deleteGroup: {
    method: "DELETE",
    path: "/api/platform/consolidation/groups/:id",
    pathParams: idParams,
    body: z.unknown().optional(),
    responses: { 200: ok, 403: errorResponse, 404: errorResponse },
    summary: "Delete a consolidation group",
  },
  getReport: {
    method: "GET",
    path: "/api/platform/consolidation/groups/:id/report",
    pathParams: idParams,
    query: consolidationReportQuerySchema,
    responses: {
      200: ok,
      400: errorResponse,
      403: errorResponse,
      404: errorResponse,
      422: errorResponse,
    },
    summary: "Translated member trial balances and the consolidated trial balance",
  },
});
