import type { FastifyPluginAsync } from "fastify";
import { auditAnomaliesQuerySchema, type User } from "@mms/contracts";
import { getRequestTenant } from "@mms/be-core/http";
import { sendForbidden } from "@mms/be-core/http/errors";
import { verifyTenantAuditChain } from "../services/auditVerificationService.js";
import { detectAuditAnomalies } from "../services/auditAnomalyService.js";
import { parseRequest, replyValidationError } from "@mms/be-core/http/routes";
import { listMerkleRoots } from "../use-cases/index.js";
import { userHasPermission } from "@mms/be-core/rbac";

export const auditIntegrityRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/audit/verify - Run automated cryptographic chain verification for this tenant shard.
   */
  fastify.post("/api/audit/verify", async (request, reply) => {
    const user = request.user as User | undefined;
    if (!userHasPermission(user, "audit.view")) {
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
    if (!userHasPermission(user, "audit.view")) {
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
    if (!userHasPermission(user, "audit.view")) {
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
