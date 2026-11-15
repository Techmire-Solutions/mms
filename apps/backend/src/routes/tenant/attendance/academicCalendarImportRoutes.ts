import type { FastifyPluginAsync } from "fastify";
import { ATTENDANCE_MODULE_MANIFEST, academicCalendarCsvImportBodySchema } from "@mms/shared";
import { registerModuleCsvImportRoutes } from "../../../lib/registerModuleCsvImportRoutes.js";
import { userHasPermission } from "../../../lib/userPermissionContext.js";

/**
 * Bulk academic-calendar event import, queued on the shared data-transfer engine.
 *
 * The shared registrar enforces the body limit, tenant isolation, idempotency keying, the
 * `attendance-calendar:import` runner guard, and the RFC 8785 audit event. Rows are persisted by
 * `registerAcademicCalendarImportJobRunner` through `academicCalendarUseCases.save`.
 */
export const academicCalendarImportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvImportRoutes(fastify, {
    canWrite: (user) => userHasPermission(user, ATTENDANCE_MODULE_MANIFEST.permissions.setupWrite),
    bodySchema: academicCalendarCsvImportBodySchema,
    moduleId: "attendance-calendar",
    defaultLabel: "Importing academic calendar…",
    entityNoun: "academic calendar event",
    queueAuditAction: "attendance.calendar.import",
  });
};
