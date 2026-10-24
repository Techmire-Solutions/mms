import type { FastifyPluginAsync } from "fastify";
import { registerSoftDeletableBulkTrashRoutes } from "../../../lib/crudBulkRoutes.js";
import { registerSingleRestoreRoute } from "../../../lib/crudRouter.js";
import { canDeleteCollection } from "../../../services/rbacService.js";
import { bulkIdsBodySchema as facultyBulkIdsSchema, type Faculty, type User } from "@mms/shared";
import { facultyUseCases } from "../../../faculty/use-cases/facultyUseCases.js";
import { auditFaculty, sanitizeOneFacultyForUser } from "./facultyRouteHelpers.js";

/** Faculty soft-delete, restore, and bulk trash routes. */
export const facultySoftDeleteRoutes: FastifyPluginAsync = async (fastify) => {
  registerSingleRestoreRoute(fastify, {
    collection: "faculty",
    nameSingular: "faculty",
    canDelete: (user) => canDeleteCollection(user, "faculty"),
    restoreFn: (id, userId) => facultyUseCases.restoreFacultyById(id, userId),
    onAfterRestore: async (user, id) => {
      await auditFaculty(user, "faculty.restore", `Restored faculty member ${id}`, id);
    },
    buildRestoreResponse: async (restored, user) => ({
      success: true,
      faculty: await sanitizeOneFacultyForUser(restored as Faculty, user as User),
    }),
  });

  registerSoftDeletableBulkTrashRoutes(fastify, {
    collection: "faculty",
    errorMessagePrefix: "faculty",
    bulkBodySchema: facultyBulkIdsSchema,
    canDelete: (user) => canDeleteCollection(user, "faculty"),
    bulkDeleteFn: (ids, user, reason) => facultyUseCases.bulkSoftDeleteFaculty(ids, user, reason),
    bulkRestoreFn: (ids, userId) => facultyUseCases.bulkRestoreFaculty(ids, userId),
    onAfterBulkDelete: async (user, result, deletionReason) => {
      const reasonNote = deletionReason?.trim() ? ` — ${deletionReason.trim()}` : "";
      await auditFaculty(
        user,
        "faculty.bulk_soft_delete",
        `Soft-deleted ${result.succeeded} faculty member(s); ${result.failed} failed${reasonNote}`,
      );
    },
    onAfterBulkRestore: async (user, result) => {
      await auditFaculty(
        user,
        "faculty.bulk_restore",
        `Restored ${result.succeeded} faculty member(s); ${result.failed} failed`,
      );
    },
  });
};
