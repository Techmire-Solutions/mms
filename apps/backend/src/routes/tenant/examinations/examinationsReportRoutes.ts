import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  EXAMINATIONS_MODULE_MANIFEST,
  normalizeExaminationsReportComparisonQuery,
  parseComparisonQueryParams,
  reportComparisonQuerySchema,
  type User,
} from "@mms/shared";
import { canReadCollection } from "../../../services/rbacService.js";
import { examinationsUseCases } from "../../../examinations/use-cases/examinationsUseCases.js";
import { sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";

const COLLECTION = EXAMINATIONS_MODULE_MANIFEST.collectionKey;

/** Examinations report SQL aggregates (ComparisonMode). */
export async function examinationsReportRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.get("/report-aggregates", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(reportComparisonQuerySchema, request.query);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const comparisonQuery = normalizeExaminationsReportComparisonQuery(
      parseComparisonQueryParams(parsed.data),
    );
    try {
      const aggregates =
        await examinationsUseCases.loadExaminationsReportAggregates(comparisonQuery);
      return reply.send(aggregates);
    } catch (e) {
      request.log.error(e, "Failed to load examinations report aggregates");
      return sendDatabaseError(reply, "Failed to load examinations report aggregates");
    }
  });
}
