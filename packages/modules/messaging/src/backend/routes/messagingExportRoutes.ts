import crypto from "node:crypto";
import { buildBackgroundJobId } from "@mms/be-core/jobs/backgroundJobIds";
import type { FastifyPluginAsync } from "fastify";
import type { BackgroundJobRecord, User } from "@mms/contracts";
import {
  canonicalizeJson,
  MESSAGING_MODULE_MANIFEST,
  messagingCsvExportBodySchema,
  messagingImportBodySchema,
} from "@mms/contracts";
import { getCsvRouteDeps } from "@mms/be-core/http/routes";
import { createStrictRateLimitGuard } from "../deps.js";
import { getRequestTenant } from "@mms/be-core/http";
import { sendForbidden } from "@mms/be-core/http/errors";
import { parseRequest, replyValidationError } from "@mms/be-core/http/routes";
import { recordModernAuditEvent } from "@mms/be-core/audit";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  getUserBackgroundJobPayload,
} from "../deps.js";
import { canWriteMessaging } from "@mms/be-core/rbac";
import { resolveIdempotencyKey, idempotencyBodyMatches } from "./messagingLogIdempotency.js";

function messagingExportBodyDigest(input: {
  query?: unknown;
  filename?: string;
  label?: string;
}): string {
  // RFC 8785 canonical JSON so a retried export with re-ordered keys still
  // matches its original digest (`mms-api-interface` §6).
  return crypto.hash(
    "sha256",
    canonicalizeJson({
      query: input.query ?? {},
      filename: input.filename ?? null,
      label: input.label ?? null,
    }),
    "hex",
  );
}

/** Queues messaging logs CSV export as a background job. */
export const messagingExportRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(async (scoped) => {
    scoped.addHook("preHandler", createStrictRateLimitGuard(scoped));

    scoped.post("/export/csv", async (request, reply) => {
      const user = request.user as User;
      if (!canWriteMessaging(user)) return sendForbidden(reply);

      const parsed = parseRequest(messagingCsvExportBodySchema, request.body);
      if (!parsed.ok) return replyValidationError(reply, parsed.message);

      const tenant = getRequestTenant();
      if (!tenant) {
        return reply
          .status(400)
          .send({ type: "validation_error", message: "Tenant context required" });
      }
      const userId = String(user.id);
      const idempotencyKey = resolveIdempotencyKey(
        parsed.data.idempotencyKey,
        request.headers["idempotency-key"],
      );
      const jobId = buildBackgroundJobId(tenant, userId, idempotencyKey);
      const bodyDigest = messagingExportBodyDigest({
        query: parsed.data.query,
        filename: parsed.data.filename,
        label: parsed.data.label,
      });

      const existing = await getUserBackgroundJob(userId, jobId);
      if (existing) {
        const payload = await getUserBackgroundJobPayload(userId, jobId);
        const existingDigest =
          typeof payload?.bodyDigest === "string" ? payload.bodyDigest : undefined;
        if (!idempotencyBodyMatches({ bodyDigest: existingDigest ?? "" }, bodyDigest)) {
          return reply.status(409).send({
            type: "conflict",
            message: "Idempotency key reused with a different export body",
          });
        }
        return reply.status(202).send({ job: existing });
      }

      const label = parsed.data.label?.trim() || "Exporting message logs…";
      const runningJob: BackgroundJobRecord = {
        id: jobId,
        moduleId: MESSAGING_MODULE_MANIFEST.moduleId,
        kind: "export",
        status: "running",
        label,
        createdAt: new Date().toISOString(),
      };

      const job = await enqueueBackgroundJob(tenant, userId, runningJob, {
        query: parsed.data.query,
        filename: parsed.data.filename,
        label,
        bodyDigest,
        // Session role so exported recipient names go through the same
        // `sanitizeContactsForViewer` gate as the recipient endpoints.
        viewerRole: String(user.role),
      });

      await recordModernAuditEvent({
        workspaceSubdomain: tenant,
        tableName: "messaging",
        recordId: jobId,
        actionType: "VIEW",
        realUserId: String(user.id),
        newState: {
          summary: `Queued messaging export "${label}"`,
          action: "messaging.export.queue",
        },
      });

      return reply.status(202).send({ job });
    });

    getCsvRouteDeps().registerCsvImportRoutes(scoped, {
      canWrite: (user: any) => canWriteMessaging(user),
      bodySchema: messagingImportBodySchema,
      moduleId: MESSAGING_MODULE_MANIFEST.moduleId,
      defaultLabel: "Importing messaging templates…",
      entityNoun: "template",
      queueAuditAction: "messaging.import",
    });
  });
};
