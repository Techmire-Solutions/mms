import type { FastifyPluginAsync } from "fastify";
import {
  FINANCE_MODULE_MANIFEST,
  financeCsvExportBodySchema,
  financeImportBodySchema,
  moduleExportAuditBodySchema,
} from "@mms/shared";
import { registerModuleCsvExportRoutes } from "../../../lib/registerModuleCsvExportRoutes.js";
import { registerModuleCsvImportRoutes } from "../../../lib/registerModuleCsvImportRoutes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";

const COLLECTION = FINANCE_MODULE_MANIFEST.collectionKey;

/** Finance CSV export queue, import queue, and export audit logging. */
export const financeExportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvExportRoutes(fastify, {
    canRead: (user) => canReadCollection(user, COLLECTION),
    canDeleteTrash: (user) => canDeleteCollection(user, COLLECTION),
    bodySchema: financeCsvExportBodySchema,
    moduleId: FINANCE_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting invoices…",
    entityNoun: "invoice",
    exportAuditAction: "finance.export",
    queueAuditAction: "finance.export.queue",
    exportAuditSchema: moduleExportAuditBodySchema,
  });

  registerModuleCsvImportRoutes(fastify, {
    canWrite: (user) => canWriteCollection(user, COLLECTION),
    bodySchema: financeImportBodySchema,
    moduleId: FINANCE_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing invoices…",
    entityNoun: "invoice",
    queueAuditAction: "finance.import",
  });
};
