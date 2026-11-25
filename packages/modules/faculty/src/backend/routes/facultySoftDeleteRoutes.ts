import type { FastifyPluginAsync } from "fastify";
import { registerSoftDeletableBulkTrashRoutes } from "@mms/be-core/http/crud";
import { registerSingleRestoreRoute } from "@mms/be-core/http/crud";
import { canDeleteCollection } from "@mms/be-core/rbac";
import { bulkIdsBodySchema as facultyBulkIdsSchema, type Faculty, type User } from "@mms/contracts";
import { facultyUseCases } from "../use-cases/index.js";
import { auditFaculty, sanitizeOneFacultyForUser } from "./facultyRouteHelpers.js";

/** Faculty soft-delete, restore, and bulk trash routes. */
export const facultySoftDeleteRoutes: FastifyPluginAsync = async (fastify) => {
  registerSingleRestoreRoute(fastify, {
    collection: "faculty",
    nameSingular: "faculty",
    canDelete: (user) => canDeleteCollection(user, "faculty"),
    restoreFn: (id, userId) => facultyUseCases.restoreFacultyById(id, userId),
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
  });
};
