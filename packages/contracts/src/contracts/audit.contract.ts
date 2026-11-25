import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  auditAnomaliesQuerySchema,
  auditAnomalyReportSchema,
  listAuditEventsQuerySchema,
} from "../audit/auditTypes.js";

const c = initContract();

const ok = z.unknown();
const errorResponse = z.object({ type: z.string(), message: z.string() }).passthrough();

/**
 * Tenant audit-trail routes. Served by plain Fastify plugins in the backend
 * (`auditEventRoutes` / `auditIntegrityRoutes` / `auditPrivacyRoutes`); declared here so the
 * ts-rest client can reach them. Response bodies stay `unknown` — the widened client
 * (ADR-010) reads the shared `Audit*Response` types at the call site.
 */
export const auditContract = c.router({
  listEvents: {
    method: "GET",
    path: "/api/audit/events",
    query: listAuditEventsQuerySchema,
    responses: { 200: ok, 403: errorResponse, 500: errorResponse },
    summary: "List audit trail events",
  },
  exportAudit: {
    method: "GET",
    path: "/api/audit/export",
    responses: { 200: ok, 403: errorResponse, 500: errorResponse },
    summary: "Export a tamper-evident audit report",
  },
  verifyChain: {
    method: "POST",
    path: "/api/audit/verify",
    // Optional body: the backend ignores it and the client sends none.
    body: z.unknown().optional(),
    responses: { 200: ok, 403: errorResponse, 500: errorResponse },
    summary: "Verify the tenant audit hash chain",
  },
  listMerkleRoots: {
    method: "GET",
    path: "/api/audit/merkle-roots",
    responses: { 200: ok, 403: errorResponse, 500: errorResponse },
    summary: "List published Merkle checkpoints",
  },
  executeErasure: {
    method: "POST",
    path: "/api/audit/erasure",
    body: z.unknown(),
    responses: { 200: ok, 403: errorResponse, 500: errorResponse },
    summary: "Execute a right-to-erasure request",
  },
  getAnomalies: {
    method: "GET",
    path: "/api/audit/anomalies",
    query: auditAnomaliesQuerySchema,
    responses: { 200: auditAnomalyReportSchema, 403: errorResponse, 500: errorResponse },
    summary: "Run audit anomaly detection",
  },
});
