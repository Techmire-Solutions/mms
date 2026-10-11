import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { desc, eq, and, sql } from "drizzle-orm";
import { listAuditEventsQuerySchema, roleHasPermission, type User } from "@mms/shared";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { sendForbidden } from "../../../lib/httpErrors.js";
import { activeDb } from "../../../db/dbConnection.js";
import { auditTrailEvents, auditVerificationRuns } from "../../../db/schema/auditTrail.js";
import { recordModernAuditEvent, getLatestShardHash } from "../../../services/auditTrailService.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { formatTraceParent } from "../../../config/telemetry.js";

/**
 * Helper to extract W3C traceparent from request context.
 */
function getCorrelationId(request: FastifyRequest): string {
  if (request.telemetrySpan) {
    return formatTraceParent(request.telemetrySpan.context);
  }
  const header = request.headers["traceparent"];
  if (typeof header === "string" && header.trim()) {
    return header.trim();
  }
  return `00-${request.id}-01`;
}

export const auditEventRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /api/audit/events - Paginated audit event list with explicit projection & statement budget.
   * Auditing the auditor: viewing audit records logs an immutable VIEW audit event.
   */
  fastify.get("/api/audit/events", async (request, reply) => {
    const user = request.user as User | undefined;
    if (!roleHasPermission(user?.role ?? "", "analytics.view")) {
      return sendForbidden(reply);
    }
    const tenant = getRequestTenant();
    if (!tenant) {
      return reply.status(403).send({ type: "forbidden", message: "Tenant required" });
    }

    const parsedQuery = parseRequest(listAuditEventsQuerySchema, request.query);
    if (!parsedQuery.ok) {
      return replyValidationError(reply, parsedQuery.message);
    }
    const query = parsedQuery.data;

    const conditions = [eq(auditTrailEvents.workspaceSubdomain, tenant)];

    if (query.tableName) {
      conditions.push(eq(auditTrailEvents.tableName, query.tableName));
    }
    if (query.recordId) {
      conditions.push(eq(auditTrailEvents.recordId, query.recordId));
    }
    if (query.actionType) {
      conditions.push(eq(auditTrailEvents.actionType, query.actionType));
    }

    const db = activeDb();
    // Explicit projection: do not dump heavy raw state on directory listings
    const [events, countResult] = await Promise.all([
      db
        .select({
          id: auditTrailEvents.id,
          workspaceSubdomain: auditTrailEvents.workspaceSubdomain,
          tableName: auditTrailEvents.tableName,
          recordId: auditTrailEvents.recordId,
          actionType: auditTrailEvents.actionType,
          realUserId: auditTrailEvents.realUserId,
          impersonatedUserId: auditTrailEvents.impersonatedUserId,
          ipAddress: auditTrailEvents.ipAddress,
          clientApp: auditTrailEvents.clientApp,
          correlationId: auditTrailEvents.correlationId,
          hashPrevious: auditTrailEvents.hashPrevious,
          hashCurrent: auditTrailEvents.hashCurrent,
          verificationStatus: auditTrailEvents.verificationStatus,
          transactionTimestamp: auditTrailEvents.transactionTimestamp,
        })
        .from(auditTrailEvents)
        .where(and(...conditions))
        .orderBy(desc(auditTrailEvents.transactionTimestamp), desc(auditTrailEvents.id))
        .limit(query.limit)
        .offset(query.offset),
      db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(auditTrailEvents)
        .where(and(...conditions)),
    ]);

    // Auditing the auditor: log inspection of audit records (fire-and-forget — must not block the read path).
    const userId = (request.user as User | undefined)?.id || "anonymous";
    void recordModernAuditEvent(db, {
      workspaceSubdomain: tenant,
      tableName: "audit_trail_events",
      recordId: `query_${Date.now()}`,
      actionType: "VIEW",
      realUserId: userId,
      correlationId: getCorrelationId(request),
      ipAddress: request.ip,
      clientApp:
        typeof request.headers["user-agent"] === "string"
          ? request.headers["user-agent"].slice(0, 64)
          : undefined,
      apiEndpoint: request.url,
      httpMethod: "GET",
    });

    return reply.send({
      items: events,
      total: countResult[0]?.count ?? 0,
      limit: query.limit,
      offset: query.offset,
    });
  });

  /**
   * GET /api/audit/export - Tamper-evident audit report export.
   * Includes cryptographic shard chain hashes and latest verification status in metadata.
   */
  fastify.get("/api/audit/export", async (request, reply) => {
    const user = request.user as User | undefined;
    if (!roleHasPermission(user?.role ?? "", "analytics.view")) {
      return sendForbidden(reply);
    }
    const tenant = getRequestTenant();
    if (!tenant) {
      return reply.status(403).send({ type: "forbidden", message: "Tenant required" });
    }

    const db = activeDb();
    const [events, headHash, latestRun] = await Promise.all([
      db
        .select({
          id: auditTrailEvents.id,
          workspaceSubdomain: auditTrailEvents.workspaceSubdomain,
          tableName: auditTrailEvents.tableName,
          recordId: auditTrailEvents.recordId,
          actionType: auditTrailEvents.actionType,
          realUserId: auditTrailEvents.realUserId,
          impersonatedUserId: auditTrailEvents.impersonatedUserId,
          ipAddress: auditTrailEvents.ipAddress,
          clientApp: auditTrailEvents.clientApp,
          sessionId: auditTrailEvents.sessionId,
          correlationId: auditTrailEvents.correlationId,
          apiEndpoint: auditTrailEvents.apiEndpoint,
          httpMethod: auditTrailEvents.httpMethod,
          oldState: auditTrailEvents.oldState,
          newState: auditTrailEvents.newState,
          hashPrevious: auditTrailEvents.hashPrevious,
          hashCurrent: auditTrailEvents.hashCurrent,
          verificationStatus: auditTrailEvents.verificationStatus,
          transactionTimestamp: auditTrailEvents.transactionTimestamp,
        })
        .from(auditTrailEvents)
        .where(eq(auditTrailEvents.workspaceSubdomain, tenant))
        .orderBy(desc(auditTrailEvents.transactionTimestamp))
        .limit(1000),
      getLatestShardHash(tenant),
      db
        .select({
          id: auditVerificationRuns.id,
          status: auditVerificationRuns.status,
          verifiedAt: auditVerificationRuns.verifiedAt,
          recordsChecked: auditVerificationRuns.recordsChecked,
          discrepancies: auditVerificationRuns.discrepancies,
        })
        .from(auditVerificationRuns)
        .where(eq(auditVerificationRuns.workspaceSubdomain, tenant))
        .orderBy(desc(auditVerificationRuns.verifiedAt))
        .limit(1),
    ]);

    const userId = (request.user as User | undefined)?.id || "anonymous";
    // Auditing the auditor: export is an auditable event (fire-and-forget — must not block the response).
    void recordModernAuditEvent(db, {
      workspaceSubdomain: tenant,
      tableName: "audit_trail_events",
      recordId: `export_${Date.now()}`,
      actionType: "VIEW",
      realUserId: userId,
      correlationId: getCorrelationId(request),
      apiEndpoint: request.url,
      httpMethod: "GET",
    });

    return reply.send({
      metadata: {
        workspaceSubdomain: tenant,
        exportedAt: new Date().toISOString(),
        exportedBy: userId,
        shardHeadHash: headHash,
        lastVerificationStatus: latestRun[0]?.status ?? "PENDING",
        lastVerificationAt: latestRun[0]?.verifiedAt ?? null,
      },
      events,
    });
  });
};
