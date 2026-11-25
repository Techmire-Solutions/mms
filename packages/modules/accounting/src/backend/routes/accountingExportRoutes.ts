import type { FastifyPluginAsync } from "fastify";
import {
  ACCOUNTING_MODULE_MANIFEST,
  accountingCsvExportBodySchema,
  accountingImportBodySchema,
  moduleExportAuditBodySchema,
  type User,
} from "@mms/contracts";
import { canDeleteCollection, canReadCollection, canWriteCollection } from "@mms/be-core/rbac";

const COLLECTION = ACCOUNTING_MODULE_MANIFEST.accountCollectionKey;

/** Accounting CSV export queue, import queue, and export audit logging. */
import { getAccountingExportRouteDeps } from "./exportRouteDeps.js";

export const accountingExportRoutes: FastifyPluginAsync = async (fastify) => {
  const deps = getAccountingExportRouteDeps();
  await deps.registerCsvExportRoutes(fastify, {
    canRead: (user: User) => canReadCollection(user, COLLECTION),
    canDeleteTrash: (user: User) => canDeleteCollection(user, COLLECTION),
    bodySchema: accountingCsvExportBodySchema,
    moduleId: ACCOUNTING_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting accounts…",
    entityNoun: "account",
    exportAuditAction: "accounting.export",
    queueAuditAction: "accounting.export.queue",
    exportAuditSchema: moduleExportAuditBodySchema,
  });

  await deps.registerCsvImportRoutes(fastify, {
    canWrite: (user: User) => canWriteCollection(user, COLLECTION),
    bodySchema: accountingImportBodySchema,
    moduleId: ACCOUNTING_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing accounts…",
    entityNoun: "account",
    queueAuditAction: "accounting.import",
  });
};
