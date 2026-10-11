import type { FastifyPluginAsync } from "fastify";
import {
  ACCOUNTING_MODULE_MANIFEST,
  accountingCsvExportBodySchema,
  accountingImportBodySchema,
  moduleExportAuditBodySchema,
} from "@mms/shared";
import { registerModuleCsvExportRoutes } from "../../../lib/registerModuleCsvExportRoutes.js";
import { registerModuleCsvImportRoutes } from "../../../lib/registerModuleCsvImportRoutes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../../services/rbacService.js";

const COLLECTION = ACCOUNTING_MODULE_MANIFEST.accountCollectionKey;

/** Accounting CSV export queue, import queue, and export audit logging. */
export const accountingExportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvExportRoutes(fastify, {
    canRead: (user) => canReadCollection(user, COLLECTION),
    canDeleteTrash: (user) => canDeleteCollection(user, COLLECTION),
    bodySchema: accountingCsvExportBodySchema,
    moduleId: ACCOUNTING_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting accounts…",
    entityNoun: "account",
    exportAuditAction: "accounting.export",
    queueAuditAction: "accounting.export.queue",
    exportAuditSchema: moduleExportAuditBodySchema,
  });

  registerModuleCsvImportRoutes(fastify, {
    canWrite: (user) => canWriteCollection(user, COLLECTION),
    bodySchema: accountingImportBodySchema,
    moduleId: ACCOUNTING_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing accounts…",
    entityNoun: "account",
    queueAuditAction: "accounting.import",
  });
};
