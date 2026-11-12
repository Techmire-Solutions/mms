import type { FastifyPluginAsync } from "fastify";
import {
  QUESTION_BANK_MODULE_MANIFEST,
  moduleExportAuditBodySchema,
  questionBankCsvExportBodySchema,
  questionBankImportBodySchema,
} from "@mms/shared";
import { registerModuleCsvExportRoutes } from "../../../lib/registerModuleCsvExportRoutes.js";
import { registerModuleCsvImportRoutes } from "../../../lib/registerModuleCsvImportRoutes.js";
import { canDeleteCollection, canWriteCollection } from "../../../services/rbacService.js";
import { userHasPermission } from "../../../lib/userPermissionContext.js";

const COLLECTION = QUESTION_BANK_MODULE_MANIFEST.collectionKey;

/** Question Bank CSV export queue, import queue, and export audit logging. */
export const questionBankExportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvExportRoutes(fastify, {
    // The CSV is the master answer key: exporting needs approver authority, not authoring.
    canRead: (user) => userHasPermission(user, "questionBank.delete"),
    canDeleteTrash: (user) => canDeleteCollection(user, COLLECTION),
    bodySchema: questionBankCsvExportBodySchema,
    moduleId: QUESTION_BANK_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting questions…",
    entityNoun: "question",
    exportAuditAction: "questionBank.export",
    queueAuditAction: "questionBank.export.queue",
    exportAuditSchema: moduleExportAuditBodySchema,
  });

  registerModuleCsvImportRoutes(fastify, {
    canWrite: (user) => canWriteCollection(user, COLLECTION),
    bodySchema: questionBankImportBodySchema,
    moduleId: QUESTION_BANK_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing questions…",
    entityNoun: "question",
    queueAuditAction: "questionBank.import",
  });
};
