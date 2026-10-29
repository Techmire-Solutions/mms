import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { listAuditEventsQuerySchema, roleHasPermission, type User } from "@mms/shared";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { sendForbidden } from "../../../lib/httpErrors.js";
import { recordAuditEventSafely, getLatestShardHash } from "../../../services/auditTrailService.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { formatTraceParent } from "../../../config/telemetry.js";
import {
  getLatestVerificationRun,
  listAuditEvents,
  listAuditEventsForExport,
} from "../../../audit/use-cases/auditQueryUseCases.js";

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
    if (!roleHasPermission(user?.role ?? "", "audit.view")) {
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

    const { items, total } = await listAuditEvents(tenant, query);

    // Auditing the auditor: log inspection of audit records (fire-and-forget — must not block the read path).
    const userId = (request.user as User | undefined)?.id || "anonymous";
    void recordAuditEventSafely({
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
      items,
      total,
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
    if (!roleHasPermission(user?.role ?? "", "audit.view")) {
      return sendForbidden(reply);
    }
    const tenant = getRequestTenant();
    if (!tenant) {
      return reply.status(403).send({ type: "forbidden", message: "Tenant required" });
    }

    const [events, headHash, latestRun] = await Promise.all([
      listAuditEventsForExport(tenant, 1000),
      getLatestShardHash(tenant),
      getLatestVerificationRun(tenant),
    ]);

    const userId = (request.user as User | undefined)?.id || "anonymous";
    // Auditing the auditor: export is an auditable event (fire-and-forget — must not block the response).
    void recordAuditEventSafely({
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
        lastVerificationStatus: latestRun?.status ?? "PENDING",
        lastVerificationAt: latestRun?.verifiedAt ?? null,
      },
      events,
    });
  });
};
