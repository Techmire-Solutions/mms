import type { FastifyInstance, FastifyPluginOptions } from "fastify";
import {
  ATTENDANCE_MODULE_MANIFEST,
  attendanceReportAggregatesHttpQuerySchema,
  normalizeAttendanceReportComparisonQuery,
  parseComparisonQueryParams,
  type User,
} from "@mms/shared";
import { canReadCollection } from "../../../services/rbacService.js";
import { attendanceUseCases } from "../../../attendance/use-cases/attendanceUseCases.js";
import { sendDatabaseError, sendForbidden } from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";

const COLLECTION = ATTENDANCE_MODULE_MANIFEST.collectionKey;

/** Attendance report SQL aggregates for analytics and optional comparison data. */
export async function attendanceReportRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.get("/report-aggregates", async (request, reply) => {
    const user = request.user as User;
    if (!canReadCollection(user, COLLECTION)) return sendForbidden(reply);
    const parsed = parseRequest(attendanceReportAggregatesHttpQuerySchema, request.query);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const comparisonQuery = normalizeAttendanceReportComparisonQuery(
      parseComparisonQueryParams(parsed.data),
    );
    try {
      const aggregates = await attendanceUseCases.loadAttendanceReportAggregates({
        ...comparisonQuery,
        ...(parsed.data.classId?.trim() ? { classId: parsed.data.classId.trim() } : {}),
      });
      return reply.send(aggregates);
    } catch {
      return sendDatabaseError(reply, "Failed to load attendance report aggregates");
    }
  });
}
