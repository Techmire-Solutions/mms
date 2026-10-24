import type { FastifyPluginAsync } from "fastify";
import {
  OBLIGATIONS_MODULE_MANIFEST,
  obligationsCsvExportBodySchema,
  obligationsImportBodySchema,
} from "@mms/shared";
import { registerModuleCsvExportRoutes } from "../../../lib/registerModuleCsvExportRoutes.js";
import { registerModuleCsvImportRoutes } from "../../../lib/registerModuleCsvImportRoutes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";

const COLLECTION = OBLIGATIONS_MODULE_MANIFEST.collectionKey;

/** Obligations CSV export queue, import queue, and export audit logging. */
export const obligationsExportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvExportRoutes(fastify, {
    canRead: (user) => canReadCollection(user, COLLECTION),
    canDeleteTrash: (user) => canDeleteCollection(user, COLLECTION),
    bodySchema: obligationsCsvExportBodySchema,
    moduleId: OBLIGATIONS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting obligations…",
    entityNoun: "obligation",
    exportAuditAction: "obligation.export",
    queueAuditAction: "obligation.export.queue",
  });

  registerModuleCsvImportRoutes(fastify, {
    canWrite: (user) => canWriteCollection(user, COLLECTION),
    bodySchema: obligationsImportBodySchema,
    moduleId: OBLIGATIONS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing obligations…",
    entityNoun: "obligation",
    queueAuditAction: "obligation.import",
  });
};
