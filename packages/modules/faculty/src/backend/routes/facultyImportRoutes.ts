import type { User } from "@mms/contracts";
import type { FastifyPluginAsync } from "fastify";
import { FACULTY_MODULE_MANIFEST, facultyImportBodySchema } from "@mms/contracts";
import { getCsvRouteDeps } from "@mms/be-core/http/routes";
import { canWriteCollection } from "@mms/be-core/rbac";

/**
 * Queued faculty member CSV import (client-parsed rows).
 *
 * Uses the shared importer registration so the queue appends one authoritative
 * `faculty.import` audit row — the per-row audit rows are intentionally skipped
 * for batch writes (`facultyWriteUseCases.ts`).
 */
export const facultyImportRoutes: FastifyPluginAsync = async (fastify) => {
  getCsvRouteDeps().registerCsvImportRoutes(fastify, {
    canWrite: (user: User) => canWriteCollection(user, "faculty"),
    bodySchema: facultyImportBodySchema,
    moduleId: FACULTY_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing faculty…",
    entityNoun: "faculty",
    queueAuditAction: "faculty.import",
  });
};
