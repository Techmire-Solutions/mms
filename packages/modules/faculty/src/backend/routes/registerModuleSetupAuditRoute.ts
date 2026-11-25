import type { FastifyInstance } from "fastify";
import type { ZodTypeAny } from "zod";
import type { Permission, User } from "@mms/contracts";
import {} from "@mms/contracts";
import { sendForbidden } from "@mms/be-core/http/errors";
import { parseRequest, replyValidationError } from "@mms/be-core/http/routes";
import { moduleSetupAuditBodySchema } from "@mms/contracts";
import { recordModernAuditEvent, mapActionStringToAuditType } from "@mms/be-core/audit";
import { getRequestTenant } from "@mms/be-core/http";
import { logger } from "@mms/be-core/logger";
import { userHasPermission } from "@mms/be-core/rbac";

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
    if (!userHasPermission(user, options.setupWritePermission)) {
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
