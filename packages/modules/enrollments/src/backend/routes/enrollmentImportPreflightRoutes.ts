import type { FastifyPluginAsync } from "fastify";
import { enrollmentImportPreflightBodySchema } from "@mms/contracts";
import type { User } from "@mms/contracts";
import { canWriteCollection } from "@mms/be-core/rbac";
import { getRequestTenant } from "@mms/be-core/http";
import { parseRequest, replyValidationError } from "@mms/be-core/http/routes";
import { sendDatabaseError, sendForbidden } from "@mms/be-core/http/errors";
import { preflightEnrollmentImport } from "../use-cases/index.js";

/**
 * `POST /api/enrollments/import/preflight` — validate an import without writing anything.
 * Runs before the queued `enrollments:import` job so a user can fix row errors first.
 */
export const enrollmentImportPreflightRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/import/preflight", { bodyLimit: 1024 * 1024 }, async (request, reply) => {
    const user = request.user as User;
    if (!canWriteCollection(user, "enrollments")) return sendForbidden(reply);
    const parsed = parseRequest(enrollmentImportPreflightBodySchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const tenant = getRequestTenant();
    if (!tenant) return sendForbidden(reply);
    try {
      const result = await preflightEnrollmentImport(tenant, parsed.data.rows);
      return reply.send(result);
    } catch (error) {
      return sendDatabaseError(reply, "Failed to validate the enrollment import", error);
    }
  });
};
