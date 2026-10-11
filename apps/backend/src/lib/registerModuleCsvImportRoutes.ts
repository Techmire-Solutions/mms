import type { FastifyInstance } from "fastify";
import type { ZodTypeAny } from "zod";
import type { User } from "@mms/shared";
import { getRequestTenant } from "./tenantContext.js";
import { sendForbidden, sendServiceUnavailable } from "./httpErrors.js";
import { parseRequest, replyValidationError } from "./zodRequest.js";
import {
  recordModernAuditEvent,
  mapActionStringToAuditType,
} from "../services/auditTrailService.js";
import { logger } from "./logger.js";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  QueueUnavailableError,
} from "../services/backgroundJobWorkerService.js";
import { randomUUID } from "node:crypto";

export type RegisterModuleCsvImportRoutesOptions = {
  canWrite: (user: User) => boolean;
  bodySchema: ZodTypeAny;
  moduleId: string;
  defaultLabel: string;
  /** Singular entity noun for audit copy, e.g. `student` / `contact`. */
  entityNoun: string;
  /** Audit action prefix, e.g. `student.import`. */
  queueAuditAction: string;
  bodyLimit?: number;
};

/**
 * Register POST `/import` for a module.
 */
export function registerModuleCsvImportRoutes(
  fastify: FastifyInstance,
  options: RegisterModuleCsvImportRoutesOptions,
): void {
  const bodyLimit = options.bodyLimit ?? 2 * 1024 * 1024;

  fastify.post("/import", { bodyLimit }, async (request, reply) => {
    const user = request.user as User;
    if (!options.canWrite(user)) return sendForbidden(reply);

    const parsed = parseRequest(options.bodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    const tenant = getRequestTenant();
    if (!tenant) return sendForbidden(reply);

    const data = parsed.data as {
      rows: unknown[];
      label?: string;
      idempotencyKey?: string;
    };

    const label = data.label?.trim() || options.defaultLabel;
    const userId = String(user.id);
    const jobId = data.idempotencyKey?.trim() || randomUUID();

    const existing = await getUserBackgroundJob(userId, jobId);
    if (existing) return reply.status(202).send({ job: existing });

    let job;
    try {
      job = await enqueueBackgroundJob(
        tenant,
        userId,
        {
          id: jobId,
          moduleId: options.moduleId,
          kind: "import",
          status: "running",
          label,
          createdAt: new Date().toISOString(),
        },
        {
          rows: data.rows,
          label,
          viewerRole: user.role,
          language: (request.headers?.["accept-language"] as string | undefined) || "en",
        },
      );
    } catch (err) {
      if (err instanceof QueueUnavailableError) {
        return sendServiceUnavailable(reply, err.message);
      }
      throw err;
    }

    void recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: options.moduleId,
      recordId: job.id,
      actionType: mapActionStringToAuditType(options.queueAuditAction),
      realUserId: userId,
      newState: {
        summary: `Queued ${options.entityNoun} import (${data.rows.length} rows)`,
        action: options.queueAuditAction,
      },
    }).catch((err: unknown) =>
      logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        "audit event append failed",
      ),
    );

    return reply.status(202).send({ job });
  });
}
