import type { FastifyPluginAsync } from "fastify";
import { auditAnomaliesQuerySchema, roleHasPermission, type User } from "@mms/shared";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { sendForbidden } from "../../../lib/httpErrors.js";
import { verifyTenantAuditChain } from "../../../services/auditVerificationService.js";
import { detectAuditAnomalies } from "../../../services/auditAnomalyService.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { listMerkleRoots } from "../../../audit/use-cases/auditQueryUseCases.js";

export const auditIntegrityRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/audit/verify - Run automated cryptographic chain verification for this tenant shard.
   */
  fastify.post("/api/audit/verify", async (request, reply) => {
    const user = request.user as User | undefined;
    if (!roleHasPermission(user?.role ?? "", "audit.view")) {
      return sendForbidden(reply);
    }
    const tenant = getRequestTenant();
    if (!tenant) {
      return reply.status(403).send({ type: "forbidden", message: "Tenant required" });
    }

    const result = await verifyTenantAuditChain(tenant);
    return reply.send(result);
  });

  /**
   * GET /api/audit/merkle-roots - Published transparency checkpoints, reduced to
   * this workspace's own head (never another tenant's hashes).
   */
  fastify.get("/api/audit/merkle-roots", async (request, reply) => {
    const user = request.user as User | undefined;
    if (!roleHasPermission(user?.role ?? "", "audit.view")) {
      return sendForbidden(reply);
    }
    const tenant = getRequestTenant();
    if (!tenant) {
      return reply.status(403).send({ type: "forbidden", message: "Tenant required" });
    }
    const roots = await listMerkleRoots(tenant, 20);
    return reply.send({ items: roots });
  });

  /**
   * GET /api/audit/anomalies - Section 6: Rule-based anomaly detection.
   */
  fastify.get("/api/audit/anomalies", async (request, reply) => {
    const user = request.user as User | undefined;
    if (!roleHasPermission(user?.role ?? "", "audit.view")) {
      return sendForbidden(reply);
    }
    const tenant = getRequestTenant();
    if (!tenant) {
      return reply.status(403).send({ type: "forbidden", message: "Tenant required" });
    }

    const parsedQuery = parseRequest(auditAnomaliesQuerySchema, request.query);
    if (!parsedQuery.ok) {
      return replyValidationError(reply, parsedQuery.message);
    }

    const report = await detectAuditAnomalies(tenant, {
      windowHours: parsedQuery.data.windowHours,
    });
    return reply.send(report);
  });
};
