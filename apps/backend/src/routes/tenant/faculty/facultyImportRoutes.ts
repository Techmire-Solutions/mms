import type { FastifyPluginAsync } from "fastify";
import { FACULTY_MODULE_MANIFEST, facultyImportBodySchema, type User } from "@mms/shared";
import { canWriteCollection } from "../../../services/rbacService.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { sendForbidden, sendServiceUnavailable } from "../../../lib/httpErrors.js";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  QueueUnavailableError,
} from "../../../services/backgroundJobWorkerService.js";
import { randomUUID } from "node:crypto";

/** Queued faculty member CSV import (client-parsed rows). */
export const facultyImportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/import", { bodyLimit: 2 * 1024 * 1024 }, async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, "faculty")) return sendForbidden(reply);

    const parsed = parseRequest(facultyImportBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);

    const tenant = getRequestTenant();
    if (!tenant) return sendForbidden(reply);

    const label = parsed.data.label?.trim() || "Importing faculty…";
    const userId = String(user.id);
    const jobId = parsed.data.idempotencyKey?.trim() || randomUUID();
    const existing = await getUserBackgroundJob(userId, jobId);
    if (existing) return reply.status(202).send({ job: existing });

    try {
      const job = await enqueueBackgroundJob(
        tenant,
        userId,
        {
          id: jobId,
          moduleId: FACULTY_MODULE_MANIFEST.moduleId,
          kind: "import",
          status: "running",
          label,
          createdAt: new Date().toISOString(),
        },
        {
          rows: parsed.data.rows,
          label,
          viewerRole: user.role,
          language: (request.headers?.["accept-language"] as string | undefined) || "en",
        },
      );
      return reply.status(202).send({ job });
    } catch (err) {
      if (err instanceof QueueUnavailableError) {
        return sendServiceUnavailable(reply, err.message);
      }
      throw err;
    }
  });
};
