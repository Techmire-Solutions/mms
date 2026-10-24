import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { authenticateTenant } from "../../middleware/authenticate.js";
import { registerModuleAccess } from "../../middleware/requireTenantModule.js";
import { attendanceUseCases } from "../../attendance/use-cases/attendanceUseCases.js";
import { ATTENDANCE_MODULE_MANIFEST } from "@mms/shared";
import { registerStandardExtendedRoutes } from "../../lib/crudRouter.js";
import { attendanceContractRouter } from "./attendance/attendanceContractRouter.js";
import { academicCalendarRouter } from "./attendance/academicCalendarRouter.js";
import { attendanceExportRoutes } from "./attendance/attendanceExportRoutes.js";

const COLLECTION = ATTENDANCE_MODULE_MANIFEST.collectionKey;

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
        loadMetricsFn: attendanceUseCases.loadAttendanceCommandMetrics,
        nameSingular: "record",
      });
    },
    { prefix: "/api/attendance" },
  );

  await fastify.register(attendanceContractRouter);
  await fastify.register(academicCalendarRouter);
}
