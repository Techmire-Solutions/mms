import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import { OBLIGATIONS_MODULE_MANIFEST, obligationsReportQuerySchema, type User } from "@mms/shared";
import { canReadCollection } from "../../../services/rbacService.js";
import { obligationsUseCases } from "../../../obligations/use-cases/obligationsUseCases.js";
import { sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";

const COLLECTION = OBLIGATIONS_MODULE_MANIFEST.collectionKey;

/** Obligations report SQL aggregates. */
export async function obligationReportRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.get("/report-aggregates", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(obligationsReportQuerySchema, request.query);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const aggregates = await obligationsUseCases.loadObligationsReportAggregates({
        dateFrom: parsed.data.dateFrom?.trim() || undefined,
        dateTo: parsed.data.dateTo?.trim() || undefined,
        typeId: parsed.data.typeId?.trim() || undefined,
        repId: parsed.data.repId?.trim() || undefined,
      });
      return reply.send(aggregates);
    } catch {
      return sendDatabaseError(reply, "Failed to load obligations report aggregates");
    }
  });
}
