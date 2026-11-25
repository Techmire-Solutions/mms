import type { User } from "@mms/contracts";
import type { FastifyPluginAsync } from "fastify";
import {
  FACULTY_MODULE_MANIFEST,
  facultyCsvExportBodySchema,
  moduleFieldsPrefsAuditBodySchema as facultySetupAuditSchema,
} from "@mms/contracts";
import { getCsvRouteDeps } from "@mms/be-core/http/routes";
import { registerModuleSetupAuditRoute } from "./registerModuleSetupAuditRoute.js";
import { canDeleteCollection, canReadCollection } from "@mms/be-core/rbac";

/** Faculty CSV export queue and Setup audit logging. */
export const facultyExportRoutes: FastifyPluginAsync = async (fastify) => {
  getCsvRouteDeps().registerCsvExportRoutes(fastify, {
    canRead: (user: User) => canReadCollection(user, "faculty"),
    canDeleteTrash: (user: User) => canDeleteCollection(user, "faculty"),
    bodySchema: facultyCsvExportBodySchema,
    moduleId: FACULTY_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting faculty…",
    entityNoun: "faculty",
    exportAuditAction: "faculty.export",
    queueAuditAction: "faculty.export.queue",
    // The queue path already writes the authoritative export audit row; a client-reportable
    // `count`/`scope` endpoint would let any reader forge export volume (contacts C-09 parity).
    registerExportAudit: false,
  });

  registerModuleSetupAuditRoute(fastify, {
    setupWritePermission: FACULTY_MODULE_MANIFEST.permissions.setupWrite,
    auditAction: "faculty.setup",
    bodySchema: facultySetupAuditSchema,
  });
};
