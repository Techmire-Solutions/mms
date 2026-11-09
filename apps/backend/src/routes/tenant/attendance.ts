import { type FastifyInstance, type FastifyPluginOptions, type FastifyRequest } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";
import { attendanceUseCases } from "../../attendance/use-cases/attendanceUseCases.js";
import { ATTENDANCE_MODULE_MANIFEST, attendanceCommandMetricsResponseSchema } from "@mms/shared";
import { registerStandardExtendedRoutes } from "../../lib/crudRouter.js";
import { attendanceContractRouter } from "./attendance/attendanceContractRouter.js";
import { academicCalendarRouter } from "./attendance/academicCalendarRouter.js";
import { academicCalendarExportRoutes } from "./attendance/academicCalendarExportRoutes.js";
import { academicCalendarImportRoutes } from "./attendance/academicCalendarImportRoutes.js";
import { attendanceExportRoutes } from "./attendance/attendanceExportRoutes.js";

const COLLECTION = ATTENDANCE_MODULE_MANIFEST.collectionKey;

/** `?date=YYYY-MM-DD` of a metrics request, or `""`. Query parsing belongs to the transport layer. */
function readMetricsDate(request: FastifyRequest): string {
  const raw = (request.query as { date?: unknown } | undefined)?.date;
  return typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : "";
}

/**
 * Attendance routes — CRUD, bulk, metrics, setup config, lookups, and reports
 * are all served through the @ts-rest contract router (attendanceContractRouter).
 * Count and metrics use raw Fastify helpers (not in the contract).
 */
export default async function attendanceRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.addHook("preHandler", authenticateTenant);
  registerModuleAccess(fastify, "attendance");

  await fastify.register(
    async (sub) => {
      await sub.register(attendanceExportRoutes);

      registerStandardExtendedRoutes(sub, {
        collection: COLLECTION,
        errorMessagePrefix: "attendance",
        loadCountFn: attendanceUseCases.countAttendanceRecords,
        // The transport layer parses the query; the use case takes a plain day. The same day is
        // declared as the metrics cache variant, otherwise `?date=A` and `?date=B` share one
        // cached payload for the TTL and one of them shows the other day's numbers.
        loadMetricsFn: (request) =>
          attendanceUseCases.loadAttendanceCommandMetrics(readMetricsDate(request)),
        cacheVary: readMetricsDate,
        // Without this the metrics payload was the only attendance response with no wire schema.
        metricsSchema: attendanceCommandMetricsResponseSchema,
        nameSingular: "record",
      });
    },
    { prefix: "/api/attendance" },
  );

  await fastify.register(attendanceContractRouter);
  await fastify.register(academicCalendarRouter);
  await fastify.register(academicCalendarExportRoutes, { prefix: "/api/attendance" });
  await fastify.register(academicCalendarImportRoutes, { prefix: "/api/attendance" });
}
