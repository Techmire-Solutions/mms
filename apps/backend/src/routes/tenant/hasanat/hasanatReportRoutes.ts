import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  HASANAT_MODULE_MANIFEST,
  normalizeHasanatReportComparisonQuery,
  parseComparisonQueryParams,
  reportComparisonQuerySchema,
  type User,
} from "@mms/shared";
import { canReadCollection } from "../../../services/rbacService.js";
import { hasanatUseCases } from "../../../hasanat/use-cases/hasanatUseCases.js";
import { sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";

const COLLECTION = HASANAT_MODULE_MANIFEST.collectionKey;

/** Hasanat report SQL aggregates (ComparisonMode session points + monthly points). */
export async function hasanatReportRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.get("/report-aggregates", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(reportComparisonQuerySchema, request.query);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const comparisonQuery = normalizeHasanatReportComparisonQuery(
      parseComparisonQueryParams(parsed.data),
    );
    try {
      const aggregates = await hasanatUseCases.loadHasanatReportAggregates(comparisonQuery);
      return reply.send(aggregates);
    } catch {
      return sendDatabaseError(reply, "Failed to load hasanat report aggregates");
    }
  });
}
