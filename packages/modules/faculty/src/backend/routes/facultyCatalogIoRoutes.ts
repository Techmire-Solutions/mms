import type { FastifyPluginAsync } from "fastify";
import {
  FACULTY_MODULE_MANIFEST,
  facultyDepartmentsCsvExportBodySchema,
  facultyDesignationsCsvExportBodySchema,
  facultyDepartmentImportBodySchema,
  facultyDesignationImportBodySchema,
  type User,
} from "@mms/contracts";
import { getCsvRouteDeps } from "@mms/be-core/http/routes";
import { canDeleteCollection, canReadCollection, canWriteCollection } from "@mms/be-core/rbac";
import { userHasPermission } from "@mms/be-core/rbac";

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
      getCsvRouteDeps().registerCsvExportRoutes(dept, {
        canRead: (user: User) => canReadCollection(user, "faculty"),
        canDeleteTrash: (user: User) => canDeleteCollection(user, "faculty"),
        bodySchema: facultyDepartmentsCsvExportBodySchema,
        moduleId: "faculty-departments",
        defaultLabel: "Exporting departments…",
        entityNoun: "department",
        exportAuditAction: "faculty.departments.export",
        queueAuditAction: "faculty.departments.export.queue",
      });

      getCsvRouteDeps().registerCsvImportRoutes(dept, {
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
      getCsvRouteDeps().registerCsvExportRoutes(desig, {
        canRead: (user: User) => canReadCollection(user, "faculty"),
        canDeleteTrash: (user: User) => canDeleteCollection(user, "faculty"),
        bodySchema: facultyDesignationsCsvExportBodySchema,
        moduleId: "faculty-designations",
        defaultLabel: "Exporting designations…",
        entityNoun: "designation",
        exportAuditAction: "faculty.designations.export",
        queueAuditAction: "faculty.designations.export.queue",
      });

      getCsvRouteDeps().registerCsvImportRoutes(desig, {
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
