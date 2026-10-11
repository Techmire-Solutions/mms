import type { FastifyPluginAsync } from "fastify";
import {
  ATTENDANCE_MODULE_MANIFEST,
  attendanceCsvExportBodySchema,
  attendanceImportBodySchema,
} from "@mms/shared";
import { registerModuleCsvExportRoutes } from "../../../lib/registerModuleCsvExportRoutes.js";
import { registerModuleCsvImportRoutes } from "../../../lib/registerModuleCsvImportRoutes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";

const COLLECTION = ATTENDANCE_MODULE_MANIFEST.collectionKey;

/** Attendance CSV export queue, import queue, and export audit logging. */
export const attendanceExportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvExportRoutes(fastify, {
    canRead: (user) => canReadCollection(user, COLLECTION),
    canDeleteTrash: (user) => canDeleteCollection(user, COLLECTION),
    bodySchema: attendanceCsvExportBodySchema,
    moduleId: ATTENDANCE_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting attendance records…",
    entityNoun: "attendance record",
    exportAuditAction: "attendance.export",
    queueAuditAction: "attendance.export.queue",
  });

  registerModuleCsvImportRoutes(fastify, {
    canWrite: (user) => canWriteCollection(user, COLLECTION),
    bodySchema: attendanceImportBodySchema,
    moduleId: ATTENDANCE_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing attendance records…",
    entityNoun: "attendance record",
    queueAuditAction: "attendance.import",
  });
};
