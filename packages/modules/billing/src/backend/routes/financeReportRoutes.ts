import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  FINANCE_MODULE_MANIFEST,
  normalizeFinanceReportComparisonQuery,
  parseComparisonQueryParams,
  reportComparisonQuerySchema,
  type User,
} from "@mms/contracts";
import { canReadCollection } from "@mms/be-core/rbac";
import { financeUseCases } from "../use-cases/index.js";
import { sendDatabaseError, sendForbidden } from "@mms/be-core/http/errors";
import { parseRequest, replyValidationError } from "@mms/be-core/http/routes";

const COLLECTION = FINANCE_MODULE_MANIFEST.collectionKey;

/** Finance report SQL aggregates (ComparisonMode feeCollected + monthly collected). */
export async function financeReportRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.get("/report-aggregates", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(reportComparisonQuerySchema, request.query);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const comparisonQuery = normalizeFinanceReportComparisonQuery(
      parseComparisonQueryParams(parsed.data),
    );
    try {
      const aggregates = await financeUseCases.loadFinanceReportAggregates(comparisonQuery);
      return reply.send(aggregates);
    } catch (err) {
      request.log.error(err, "Failed to load finance report aggregates");
      return sendDatabaseError(reply, "Failed to load finance report aggregates", err);
    }
  });
}
