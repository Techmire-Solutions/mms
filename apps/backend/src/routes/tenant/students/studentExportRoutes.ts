import type { FastifyPluginAsync } from "fastify";
import {
  STUDENTS_MODULE_MANIFEST,
  moduleFieldsPrefsAuditBodySchema as studentSetupAuditSchema,
  studentsCsvExportBodySchema,
  studentsImportBodySchema,
} from "@mms/shared";
import { registerModuleCsvExportRoutes } from "../../../lib/registerModuleCsvExportRoutes.js";
import { registerModuleCsvImportRoutes } from "../../../lib/registerModuleCsvImportRoutes.js";
import { registerModuleSetupAuditRoute } from "../../../lib/registerModuleSetupAuditRoute.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";

/** Students CSV export queue, import queue, export audit, and Setup audit logging. */
export const studentExportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvExportRoutes(fastify, {
    canRead: (user) => canReadCollection(user, "students"),
    canDeleteTrash: (user) => canDeleteCollection(user, "students"),
    bodySchema: studentsCsvExportBodySchema,
    moduleId: STUDENTS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting students…",
    entityNoun: "student",
    exportAuditAction: "student.export",
    queueAuditAction: "student.export.queue",
  });

  registerModuleCsvImportRoutes(fastify, {
    canWrite: (user) => canWriteCollection(user, "students"),
    bodySchema: studentsImportBodySchema,
    moduleId: STUDENTS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing students…",
    entityNoun: "student",
    queueAuditAction: "student.import",
  });

  registerModuleSetupAuditRoute(fastify, {
    setupWritePermission: STUDENTS_MODULE_MANIFEST.permissions.setupWrite,
    auditAction: "student.setup",
    bodySchema: studentSetupAuditSchema,
  });
};
