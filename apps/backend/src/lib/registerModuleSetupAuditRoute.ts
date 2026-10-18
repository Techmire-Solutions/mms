import type { FastifyInstance } from "fastify";
import type { ZodTypeAny } from "zod";
import type { Permission, User } from "@mms/shared";
import { roleHasPermission } from "@mms/shared";
import { sendForbidden } from "./httpErrors.js";
import { parseRequest, replyValidationError } from "./zodRequest.js";
import { moduleSetupAuditBodySchema } from "@mms/shared";
import {
  recordModernAuditEvent,
  mapActionStringToAuditType,
} from "../services/auditTrailService.js";
import { getRequestTenant } from "./tenantContext.js";
import { logger } from "./logger.js";

export type RegisterModuleSetupAuditRouteOptions = {
  setupWritePermission: Permission;
  auditAction: string;
  bodySchema?: ZodTypeAny;
};

/**
 * Register POST `/setup-audit` for module Setup Fields/Preferences (and Contacts sync).
 */
export function registerModuleSetupAuditRoute(
  fastify: FastifyInstance,
  options: RegisterModuleSetupAuditRouteOptions,
): void {
  const bodySchema = options.bodySchema ?? moduleSetupAuditBodySchema;

  fastify.post("/setup-audit", async (request, reply) => {
    const user = request.user as User;
    if (!roleHasPermission(user.role, options.setupWritePermission)) {
      return sendForbidden(reply);
    }

    const parsed = parseRequest(bodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    const data = parsed.data as { area: string; summary: string };
    const tenant = getRequestTenant();
    if (!tenant) return reply.send({ success: true });
    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: `setup:${data.area}`,
      recordId: `setup:${data.area}`,
      actionType: mapActionStringToAuditType(options.auditAction),
      realUserId: String(user.id),
      newState: data.summary
        ? { summary: data.summary, action: options.auditAction }
        : { action: options.auditAction },
    }).catch((err: unknown) =>
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        "audit event append failed",
      ),
    );
    return reply.send({ success: true });
  });
}
