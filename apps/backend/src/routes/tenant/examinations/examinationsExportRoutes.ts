import type { FastifyPluginAsync } from "fastify";
import {
  EXAMINATIONS_MODULE_MANIFEST,
  examinationsCsvExportBodySchema,
  examinationsImportBodySchema,
} from "@mms/shared";
import { registerModuleCsvExportRoutes } from "../../../lib/registerModuleCsvExportRoutes.js";
import { registerModuleCsvImportRoutes } from "../../../lib/registerModuleCsvImportRoutes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";

const COLLECTION = EXAMINATIONS_MODULE_MANIFEST.collectionKey;

/** Examinations CSV export queue, import queue, and export audit logging. */
export const examinationsExportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvExportRoutes(fastify, {
    canRead: (user) => canReadCollection(user, COLLECTION),
    canDeleteTrash: (user) => canDeleteCollection(user, COLLECTION),
    bodySchema: examinationsCsvExportBodySchema,
    moduleId: EXAMINATIONS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting examinations…",
    entityNoun: "examination",
    exportAuditAction: "examination.export",
    queueAuditAction: "examination.export.queue",
  });

  registerModuleCsvImportRoutes(fastify, {
    canWrite: (user) => canWriteCollection(user, COLLECTION),
    bodySchema: examinationsImportBodySchema,
    moduleId: EXAMINATIONS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing examinations…",
    entityNoun: "examination",
    queueAuditAction: "examination.import",
  });
};
