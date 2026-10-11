import type { FastifyPluginAsync } from "fastify";
import { desc } from "drizzle-orm";
import { auditAnomaliesQuerySchema, roleHasPermission, type User } from "@mms/shared";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { sendForbidden } from "../../../lib/httpErrors.js";
import { activeDb } from "../../../db/dbConnection.js";
import { auditMerkleRoots } from "../../../db/schema/auditTrail.js";
import {
  verifyTenantAuditChain,
  computeAndPublishMerkleCheckpoint,
} from "../../../services/auditVerificationService.js";
import { detectAuditAnomalies } from "../../../services/auditAnomalyService.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";

export const auditIntegrityRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * POST /api/audit/verify - Run automated cryptographic chain verification for this tenant shard.
   */
  fastify.post("/api/audit/verify", async (request, reply) => {
    const user = request.user as User | undefined;
    if (!roleHasPermission(user?.role ?? "", "analytics.view")) {
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
   * GET /api/audit/merkle-roots - Retrieve published transparency checkpoints.
   */
  fastify.get("/api/audit/merkle-roots", async (_request, reply) => {
    const db = activeDb();
    const roots = await db
      .select({
        id: auditMerkleRoots.id,
        rootHash: auditMerkleRoots.rootHash,
        periodStart: auditMerkleRoots.periodStart,
        periodEnd: auditMerkleRoots.periodEnd,
        shardCount: auditMerkleRoots.shardCount,
        publishedAt: auditMerkleRoots.publishedAt,
      })
      .from(auditMerkleRoots)
      .orderBy(desc(auditMerkleRoots.publishedAt))
      .limit(20);

    return reply.send({ items: roots });
  });

  /**
   * POST /api/audit/merkle-roots - Trigger Merkle tree rollup across shard heads.
   */
  fastify.post("/api/audit/merkle-roots", async (request, reply) => {
    const user = request.user as User | undefined;
    if (!roleHasPermission(user?.role ?? "", "analytics.view")) {
      return sendForbidden(reply);
    }
    const rollup = await computeAndPublishMerkleCheckpoint();
    return reply.send(rollup);
  });

  /**
   * GET /api/audit/anomalies - Section 6: Rule-based anomaly detection.
   */
  fastify.get("/api/audit/anomalies", async (request, reply) => {
    const user = request.user as User | undefined;
    if (!roleHasPermission(user?.role ?? "", "analytics.view")) {
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
