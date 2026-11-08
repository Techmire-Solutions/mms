import type { FastifyPluginAsync } from "fastify";
import { enrollmentImportPreflightBodySchema } from "@mms/shared";
import type { User } from "@mms/shared";
import { canWriteCollection } from "../../../services/rbacService.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";
import { preflightEnrollmentImport } from "../../../enrollments/use-cases/enrollmentImportUseCases.js";

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
