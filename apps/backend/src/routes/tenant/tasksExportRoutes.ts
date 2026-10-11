import type { FastifyPluginAsync } from "fastify";
import {
  TASKS_MODULE_MANIFEST,
  tasksCsvExportBodySchema,
  tasksImportBodySchema,
} from "@mms/shared";
import { registerModuleCsvExportRoutes } from "../../lib/registerModuleCsvExportRoutes.js";
import { registerModuleCsvImportRoutes } from "../../lib/registerModuleCsvImportRoutes.js";
import {
  canDeleteCollection,
  canReadCollection,
  canWriteCollection,
} from "../../services/rbacService.js";

const COLLECTION = TASKS_MODULE_MANIFEST.collectionKey;

/** Tasks CSV export queue, import queue, and export audit logging. */
export const tasksExportRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleCsvExportRoutes(fastify, {
    canRead: (user) => canReadCollection(user, COLLECTION),
    canDeleteTrash: (user) => canDeleteCollection(user, COLLECTION),
    bodySchema: tasksCsvExportBodySchema,
    moduleId: TASKS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Exporting tasks…",
    entityNoun: "task",
    exportAuditAction: "tasks.export",
    queueAuditAction: "tasks.export.queue",
  });

  registerModuleCsvImportRoutes(fastify, {
    canWrite: (user) => canWriteCollection(user, COLLECTION),
    bodySchema: tasksImportBodySchema,
    moduleId: TASKS_MODULE_MANIFEST.moduleId,
    defaultLabel: "Importing tasks…",
    entityNoun: "task",
    queueAuditAction: "tasks.import",
  });
};
