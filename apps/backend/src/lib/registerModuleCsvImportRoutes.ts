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
import {
  BackgroundJobLimitError,
  enqueueBackgroundJob,
  getUserBackgroundJob,
  getUserBackgroundJobPayload,
  hasBackgroundJobRunner,
  QueueUnavailableError,
  retryFailedBackgroundJob,
} from "../services/backgroundJobWorkerService.js";
import { buildBackgroundJobId, buildDeterministicJobKey } from "./backgroundJobIds.js";

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

    // Validate the document before the capability check: a malformed body is a 400 whatever this
    // deployment can run, and answering 503 first hid a wrong blueprint behind "not available"
    // (the obligations import schema described the tasks document — audit T5).
    const parsed = parseRequest(options.bodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    // Never accept rows we cannot process: the attendance import contract is still the legacy
    // name-based shape with no runner, so this route answers 503 instead of enqueueing a doomed job.
    if (!hasBackgroundJobRunner(`${options.moduleId}:import`)) {
      return sendServiceUnavailable(
        reply,
        "CSV import is not available for this module on this deployment",
      );
    }

    const tenant = getRequestTenant();
    if (!tenant) return sendForbidden(reply);

    const data = parsed.data as {
      rows: unknown[];
      label?: string;
      idempotencyKey?: string;
    };

    const label = data.label?.trim() || options.defaultLabel;
    const userId = String(user.id);
    const idempotencyKey =
      data.idempotencyKey ??
      buildDeterministicJobKey({
        moduleId: options.moduleId,
        kind: "import",
        payload: { rows: data.rows },
      });
    const jobId = buildBackgroundJobId(tenant, userId, idempotencyKey);

    const clientKey = data.idempotencyKey?.trim();
    const existing = await getUserBackgroundJob(userId, jobId);
    if (existing) {
      const importPayload = {
        rows: data.rows,
        label,
        viewerRole: user.role,
        language: (request.headers?.["accept-language"] as string | undefined) || "en",
      };
      if (existing.status === "failed") {
        return reply
          .status(202)
          .send({ job: await retryFailedBackgroundJob(tenant, userId, existing, importPayload) });
      }
      // Same key, different body: never silently ignore the new rows.
      const stored = await getUserBackgroundJobPayload(userId, jobId);
      if (stored && Array.isArray(stored.rows)) {
        if (JSON.stringify(stored.rows) !== JSON.stringify(data.rows)) {
          return reply.status(409).send({
            type: "conflict",
            message:
              "This idempotency key was already used for a different row set — start a new import",
          });
        }
      } else if (clientKey && existing.status === "completed") {
        // A finished job drops the row payload (PII); a client-supplied key that cannot be
        // verified against the stored body must not silently return the old result.
        return reply.status(409).send({
          type: "conflict",
          message:
            "This idempotency key belongs to a finished job whose rows were discarded — start a new import with a new key",
        });
      }
      return reply.status(202).send({ job: existing });
    }

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
      if (err instanceof BackgroundJobLimitError) {
        return reply.status(429).send({ type: "background_job_limit", message: err.message });
      }
      if (err instanceof QueueUnavailableError) {
        return sendServiceUnavailable(reply, err.message);
      }
      throw err;
    }

    await recordModernAuditEvent({
      workspaceSubdomain: tenant,
      tableName: options.moduleId,
      recordId: job.id,
      actionType: mapActionStringToAuditType(options.queueAuditAction),
      realUserId: userId,
      newState: {
        summary: `Queued ${options.entityNoun} import (${data.rows.length} rows)`,
        action: options.queueAuditAction,
      },
    });

    return reply.status(202).send({ job });
  });
}
