import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import type { User } from "@mms/shared";
import { SESSIONS_MODULE_MANIFEST } from "@mms/shared";
import { canReadCollection } from "../../../services/rbacService.js";
import { sessionsUseCases } from "../../../sessions/use-cases/sessionsUseCases.js";
import { sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";

const COLLECTION = SESSIONS_MODULE_MANIFEST.collectionKey;

/** Sessions Reports SQL aggregates (capacity / enrollment trends / today's timetable). */
export async function sessionReportRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.get("/report-aggregates", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    try {
      const aggregates = await sessionsUseCases.loadSessionsReportAggregates();
      return reply.send(aggregates);
    } catch {
      return sendDatabaseError(reply, "Failed to load sessions report aggregates");
    }
  });
}
