import type { FastifyPluginAsync } from "fastify";
import {
  HASANAT_MODULE_MANIFEST,
  hasanatCsvExportBodySchema,
  hasanatImportBodySchema,
} from "@mms/shared";
import { registerModuleCsvExportRoutes } from "../../../lib/registerModuleCsvExportRoutes.js";
import { registerModuleCsvImportRoutes } from "../../../lib/registerModuleCsvImportRoutes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";

const COLLECTION = HASANAT_MODULE_MANIFEST.collectionKey;

/** Hasanat CSV export queue, import queue, and export audit logging. */
export const hasanatExportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvExportRoutes(fastify, {
    canRead: (user) => canReadCollection(user, COLLECTION),
    canDeleteTrash: (user) => canDeleteCollection(user, COLLECTION),
    bodySchema: hasanatCsvExportBodySchema,
    moduleId: HASANAT_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting hasanat deeds…",
    entityNoun: "hasanat deed",
    exportAuditAction: "hasanat.export",
    queueAuditAction: "hasanat.export.queue",
  });

  registerModuleCsvImportRoutes(fastify, {
    canWrite: (user) => canWriteCollection(user, COLLECTION),
    bodySchema: hasanatImportBodySchema,
    moduleId: HASANAT_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing hasanat deeds…",
    entityNoun: "hasanat deed",
    queueAuditAction: "hasanat.import",
  });
};
