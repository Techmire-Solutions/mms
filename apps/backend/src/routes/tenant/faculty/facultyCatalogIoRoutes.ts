import type { FastifyPluginAsync } from "fastify";
import {
  FACULTY_MODULE_MANIFEST,
  facultyDepartmentsCsvExportBodySchema,
  facultyDesignationsCsvExportBodySchema,
  facultyDepartmentImportBodySchema,
  facultyDesignationImportBodySchema,
  type User,
} from "@mms/shared";
import { registerModuleCsvExportRoutes } from "../../../lib/registerModuleCsvExportRoutes.js";
import { registerModuleCsvImportRoutes } from "../../../lib/registerModuleCsvImportRoutes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";
import { userHasPermission } from "../../../lib/userPermissionContext.js";

const setupWrite = FACULTY_MODULE_MANIFEST.permissions.setupWrite;

function canSetupWrite(user: User): boolean {
  return canWriteCollection(user, "faculty") && userHasPermission(user, setupWrite);
}

/**
 * Department/designation CSV export + import under `/departments` and
 * `/designations`. Imports go through the shared registration so each queue
 * appends its own authoritative audit row.
 */
export const facultyCatalogIoRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(
    async (dept) => {
      registerModuleCsvExportRoutes(dept, {
        canRead: (user) => canReadCollection(user, "faculty"),
        canDeleteTrash: (user) => canDeleteCollection(user, "faculty"),
        bodySchema: facultyDepartmentsCsvExportBodySchema,
        moduleId: "faculty-departments",
        defaultLabel: "Exporting departments…",
        entityNoun: "department",
        exportAuditAction: "faculty.departments.export",
        queueAuditAction: "faculty.departments.export.queue",
      });

      registerModuleCsvImportRoutes(dept, {
        canWrite: canSetupWrite,
        bodySchema: facultyDepartmentImportBodySchema,
        moduleId: "faculty-departments",
        defaultLabel: "Importing departments…",
        entityNoun: "department",
        queueAuditAction: "faculty.departments.import",
      });
    },
    { prefix: "/departments" },
  );

  await fastify.register(
    async (desig) => {
      registerModuleCsvExportRoutes(desig, {
        canRead: (user) => canReadCollection(user, "faculty"),
        canDeleteTrash: (user) => canDeleteCollection(user, "faculty"),
        bodySchema: facultyDesignationsCsvExportBodySchema,
        moduleId: "faculty-designations",
        defaultLabel: "Exporting designations…",
        entityNoun: "designation",
        exportAuditAction: "faculty.designations.export",
        queueAuditAction: "faculty.designations.export.queue",
      });

      registerModuleCsvImportRoutes(desig, {
        canWrite: canSetupWrite,
        bodySchema: facultyDesignationImportBodySchema,
        moduleId: "faculty-designations",
        defaultLabel: "Importing designations…",
        entityNoun: "designation",
        queueAuditAction: "faculty.designations.import",
      });
    },
    { prefix: "/designations" },
  );
};
