import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/contracts";
import {
  EXAMINATIONS_MODULE_MANIFEST,
  examinationsCsvExportBodySchema,
  examinationsImportBodySchema,
} from "@mms/contracts";
import { getCsvRouteDeps } from "@mms/be-core/http/routes";
import { canDeleteCollection, canReadCollection } from "@mms/be-core/rbac";

const COLLECTION = EXAMINATIONS_MODULE_MANIFEST.collectionKey;

/** Examinations CSV export queue, import queue, and export audit logging. */
export const examinationsExportRoutes: FastifyPluginAsync = async (fastify) => {
  getCsvRouteDeps().registerCsvExportRoutes(fastify, {
    canRead: (user: User) => canReadCollection(user, COLLECTION),
    canDeleteTrash: (user: User) => canDeleteCollection(user, COLLECTION),
    bodySchema: examinationsCsvExportBodySchema,
    moduleId: EXAMINATIONS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting examinations…",
    entityNoun: "examination",
    exportAuditAction: "examination.export",
    queueAuditAction: "examination.export.queue",
  });

  getCsvRouteDeps().registerCsvImportRoutes(fastify, {
    // The exams CSV import creates/edits scoring frames and status: controller authority, not the
    // ordinary write grant. The marks import (per exam) keeps `examinations.write` + section scope.
    canWrite: (user: User) => canDeleteCollection(user, COLLECTION),
    bodySchema: examinationsImportBodySchema,
    moduleId: EXAMINATIONS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing examinations…",
    entityNoun: "examination",
    queueAuditAction: "examination.import",
  });
};
