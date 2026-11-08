import type { FastifyPluginAsync } from "fastify";
import {
  ENROLLMENTS_MODULE_MANIFEST,
  enrollmentsCsvExportBodySchema,
  enrollmentsImportBodySchema,
} from "@mms/shared";
import { registerModuleCsvExportRoutes } from "../../../lib/registerModuleCsvExportRoutes.js";
import { registerModuleCsvImportRoutes } from "../../../lib/registerModuleCsvImportRoutes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";

/** Enrollments CSV export queue, import queue, and export audit logging. */
export const enrollmentExportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvExportRoutes(fastify, {
    canRead: (user) => canReadCollection(user, ENROLLMENTS_MODULE_MANIFEST.collectionKey),
    canDeleteTrash: (user) => canDeleteCollection(user, ENROLLMENTS_MODULE_MANIFEST.collectionKey),
    bodySchema: enrollmentsCsvExportBodySchema,
    moduleId: ENROLLMENTS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting enrollments…",
    entityNoun: "enrollment",
    exportAuditAction: "enrollment.export",
    queueAuditAction: "enrollment.export.queue",
  });

  registerModuleCsvImportRoutes(fastify, {
    canWrite: (user) => canWriteCollection(user, ENROLLMENTS_MODULE_MANIFEST.collectionKey),
    bodySchema: enrollmentsImportBodySchema,
    // Matches the 1MB BullMQ payload ceiling so an oversized import fails with 413 here
    // instead of being accepted and rejected later as "queue unavailable".
    bodyLimit: 1024 * 1024,
    moduleId: ENROLLMENTS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing enrollments…",
    entityNoun: "enrollment",
    queueAuditAction: "enrollment.import",
  });
};
