import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  ENROLLMENTS_MODULE_MANIFEST,
  normalizeEnrollmentsReportComparisonQuery,
  parseComparisonQueryParams,
  reportComparisonQuerySchema,
  type User,
} from "@mms/shared";
import { canReadCollection } from "../../../services/rbacService.js";
import { enrollmentsUseCases } from "../../../enrollments/use-cases/enrollmentsUseCases.js";
import { sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";

const COLLECTION = ENROLLMENTS_MODULE_MANIFEST.collectionKey;

/** Enrollments report SQL aggregates (EnrollmentChart + EnrollmentReports + ComparisonMode). */
export async function enrollmentReportRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.get("/report-aggregates", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(reportComparisonQuerySchema, request.query);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const comparisonQuery = normalizeEnrollmentsReportComparisonQuery(
      parseComparisonQueryParams(parsed.data),
    );
    try {
      const aggregates = await enrollmentsUseCases.loadEnrollmentsReportAggregates(comparisonQuery);
      return reply.send(aggregates);
    } catch {
      return sendDatabaseError(reply, "Failed to load enrollments report aggregates");
    }
  });
}
