import type { FastifyPluginAsync } from "fastify";
import {
  STUDENTS_MODULE_MANIFEST,
  moduleFieldsPrefsAuditBodySchema as studentSetupAuditSchema,
  studentsCsvExportBodySchema,
  studentsImportBodySchema,
} from "@mms/contracts";
import { registerModuleCsvExportRoutes } from "../lib/registerModuleCsvExportRoutes.js";
import { registerModuleCsvImportRoutes } from "../lib/registerModuleCsvImportRoutes.js";
import { registerModuleSetupAuditRoute } from "../lib/registerModuleSetupAuditRoute.js";
import { ForbiddenError } from "@mms/be-core/http/errors";
import {
  filterStudentIdsInAssignedSections,
  resolveStudentAccessScope,
} from "../use-cases/index.js";
import { canDeleteCollection, canReadCollection, canWriteCollection } from "@mms/be-core/rbac";

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
    // The queue path already writes the authoritative export audit row; a client-reportable
    // `count`/`scope` endpoint would let any reader forge export volume (contacts C-09 parity).
    registerExportAudit: false,
    // Section-limited roles export only their sections' students; an explicit id
    // selection that survives no scope check is rejected instead of exporting all.
    resolveQueryScope: async ({ user, request, query }) => {
      const tenantId = String(request.tenant?.id ?? "");
      const scope = await resolveStudentAccessScope(tenantId, user);
      if (scope.isUnrestricted) return undefined;
      const scopedSectionIds = scope.assignedSectionIds;
      const requestedIds = Array.isArray(query.includeIds)
        ? query.includeIds.map(String)
        : undefined;
      if (requestedIds && requestedIds.length > 0) {
        const allowed = await filterStudentIdsInAssignedSections(
          tenantId,
          requestedIds,
          scopedSectionIds,
        );
        if (allowed.length === 0) {
          throw new ForbiddenError("No selected students are in your assigned sections");
        }
        return { scopedSectionIds, includeIds: allowed };
      }
      return { scopedSectionIds };
    },
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
