import type { FastifyPluginAsync } from "fastify";
import {
  FACULTY_MODULE_MANIFEST,
  facultyCsvExportBodySchema,
  moduleFieldsPrefsAuditBodySchema as facultySetupAuditSchema,
} from "@mms/shared";
import { registerModuleCsvExportRoutes } from "../../../lib/registerModuleCsvExportRoutes.js";
import { registerModuleSetupAuditRoute } from "../../../lib/registerModuleSetupAuditRoute.js";
import { canDeleteCollection, canReadCollection } from "../../../services/rbacService.js";

/** Faculty CSV export queue, export audit, and Setup audit logging. */
export const facultyExportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvExportRoutes(fastify, {
    canRead: (user) => canReadCollection(user, "faculty"),
    canDeleteTrash: (user) => canDeleteCollection(user, "faculty"),
    bodySchema: facultyCsvExportBodySchema,
    moduleId: FACULTY_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting faculty…",
    entityNoun: "faculty",
    exportAuditAction: "faculty.export",
    queueAuditAction: "faculty.export.queue",
  });

  registerModuleSetupAuditRoute(fastify, {
    setupWritePermission: FACULTY_MODULE_MANIFEST.permissions.setupWrite,
    auditAction: "faculty.setup",
    bodySchema: facultySetupAuditSchema,
  });
};
