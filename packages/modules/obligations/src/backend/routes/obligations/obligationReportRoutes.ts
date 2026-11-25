import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  OBLIGATIONS_MODULE_MANIFEST,
  obligationsReportQuerySchema,
  type User,
} from "@mms/contracts";
import { canReadCollection } from "@mms/be-core/rbac";
import { obligationsUseCases } from "../../use-cases/index.js";
import { sendDatabaseError, sendForbidden, sendIfHttpDomainError } from "@mms/be-core/http/errors";
import { parseRequest, replyValidationError } from "@mms/be-core/http/routes";

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
    } catch (error: unknown) {
      // Keep the module's error contract: a typed domain rejection is not a database failure.
      return (
        sendIfHttpDomainError(reply, error) ??
        sendDatabaseError(reply, "Failed to load obligations report aggregates", error)
      );
    }
  });
}
