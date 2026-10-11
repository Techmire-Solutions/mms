import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/shared";
import {
  messagingLogsQuerySchema,
  messagingMetricsQuerySchema,
  recordMessageLogsSchema,
} from "@mms/shared";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";
import { MESSAGING_LOG_RATE_LIMIT } from "../../../lib/rateLimitConfig.js";
import { createStrictRateLimitGuard } from "../../../lib/rateLimitGuard.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { recordModernAuditEvent } from "../../../services/auditTrailService.js";
import { logger } from "../../../lib/logger.js";
import { canClearMessagingLogs, canReadMessaging } from "../../../services/rbacService.js";
import { messagingUseCases } from "../../../messaging/use-cases/messagingUseCases.js";
import { handleRecordMessageLogs } from "./messagingLogRecordHandler.js";

/** Messaging log history, recording, clear, and metrics routes. */
export const messagingLogRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/logs", async (req, reply) => {
    const user = req.user as User;
    if (!canReadMessaging(user)) return sendForbidden(reply);
    const parsedQuery = parseRequest(messagingLogsQuerySchema, req.query);
    if (!parsedQuery.ok) return replyValidationError(reply, parsedQuery.message);
    if (parsedQuery.data.includeDeleted && !canClearMessagingLogs(user)) {
      return sendForbidden(reply);
    }
    const tenantSubdomain = getRequestTenant();
    if (!tenantSubdomain) {
      return reply
        .status(400)
        .send({ type: "validation_error", message: "Tenant context required" });
    }
    try {
      const page = await messagingUseCases.loadFilteredMessageLogs(
        tenantSubdomain,
        parsedQuery.data,
      );
      return reply.send(page);
    } catch (err) {
      return sendDatabaseError(reply, "Failed to load message logs", err);
    }
  });

  await fastify.register(async (scoped) => {
    scoped.addHook("preHandler", createStrictRateLimitGuard(scoped, MESSAGING_LOG_RATE_LIMIT));

    scoped.post("/logs", async (req, reply) => {
      const parsed = parseRequest(recordMessageLogsSchema, req.body);
      if (!parsed.ok) return replyValidationError(reply, parsed.message);
      return handleRecordMessageLogs(req, reply, parsed.data);
    });
  });

  fastify.delete("/logs", async (req, reply) => {
    const user = req.user as User;
    if (!canClearMessagingLogs(user)) return sendForbidden(reply);
    const tenantSubdomain = getRequestTenant();
    if (!tenantSubdomain) {
      return reply
        .status(400)
        .send({ type: "validation_error", message: "Tenant context required" });
    }
    try {
      await messagingUseCases.clearAllMessageLogs(tenantSubdomain);
      void recordModernAuditEvent({
        workspaceSubdomain: tenantSubdomain,
        tableName: "message_logs",
        recordId: "message_logs",
        actionType: "DELETE",
        realUserId: String(user.id),
        newState: {
          summary: "Soft-archived all message logs from Reports",
          action: "messaging.logs.clear",
        },
      }).catch((err: unknown) =>
        logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          "audit event append failed",
        ),
      );
      return reply.send({ success: true });
    } catch (err) {
      return sendDatabaseError(reply, "Failed to clear message logs", err);
    }
  });

  fastify.get("/metrics", async (req, reply) => {
    const user = req.user as User;
    if (!canReadMessaging(user)) return sendForbidden(reply);
    const parsedQuery = parseRequest(messagingMetricsQuerySchema, req.query);
    if (!parsedQuery.ok) return replyValidationError(reply, parsedQuery.message);
    const tenantSubdomain = getRequestTenant();
    if (!tenantSubdomain) {
      return reply
        .status(400)
        .send({ type: "validation_error", message: "Tenant context required" });
    }
    try {
      const metrics = await messagingUseCases.computeMessagingMetrics(tenantSubdomain, {
        startDate: parsedQuery.data.startDate,
        endDate: parsedQuery.data.endDate,
      });
      return reply.send({ metrics });
    } catch (err) {
      return sendDatabaseError(reply, "Failed to load messaging metrics", err);
    }
  });
};
