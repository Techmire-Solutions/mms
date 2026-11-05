import type { FastifyPluginAsync } from "fastify";
import { FACULTY_MODULE_MANIFEST, facultyImportBodySchema } from "@mms/shared";
import { registerModuleCsvImportRoutes } from "../../../lib/registerModuleCsvImportRoutes.js";
import { canWriteCollection } from "../../../services/rbacService.js";

/**
 * Queued faculty member CSV import (client-parsed rows).
 *
 * Uses the shared importer registration so the queue appends one authoritative
 * `faculty.import` audit row — the per-row audit rows are intentionally skipped
 * for batch writes (`facultyWriteUseCases.ts`).
 */
export const facultyImportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvImportRoutes(fastify, {
    canWrite: (user) => canWriteCollection(user, "faculty"),
    bodySchema: facultyImportBodySchema,
    moduleId: FACULTY_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing faculty…",
    entityNoun: "faculty",
    queueAuditAction: "faculty.import",
  });
};
