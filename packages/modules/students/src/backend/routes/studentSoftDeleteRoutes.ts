import type { FastifyPluginAsync } from "fastify";
import type { Student, User } from "@mms/contracts";
import { studentRecordSchema } from "@mms/contracts";
import { registerResourceRoutes } from "@mms/be-core/http/crud";
import { registerSoftDeletableBulkTrashRoutes } from "@mms/be-core/http/crud";
import { studentUseCases } from "../use-cases/index.js";
import { StudentRestoreConflictError } from "../use-cases/index.js";
import { canDeleteCollection } from "@mms/be-core/rbac";
import { bulkIdsBodySchema as studentsBulkIdsSchema } from "@mms/contracts";
import { auditStudent, sanitizeOneStudentForUser } from "./studentRouteHelpers.js";

/**
 * Students soft-delete / restore / bulk trash routes (Contacts parity).
 *
 * Single delete/restore use the granular resource registrar with a sanitized
 * restore payload and a GR-conflict → 400 mapping; bulk ops run in one tx via
 * the domain use cases and broadcast once.
 */
function mapStudentRestoreError(error: unknown) {
  if (error instanceof StudentRestoreConflictError) {
    return {
      statusCode: 400,
      body: {
        type: error.type,
        message: error.message,
        errors: [{ field: error.field, message: error.message }],
      },
    };
  }
  return null;
}

export const studentSoftDeleteRoutes: FastifyPluginAsync = async (fastify) => {
  registerResourceRoutes(fastify, {
    collection: "students",
    schema: studentRecordSchema,
    nameSingular: "student",
    namePlural: "students",
    customGetRoute: true,
    customGetSingleRoute: true,
    customPostRoute: true,
    customPutRoute: true,
    canDelete: (user) => canDeleteCollection(user, "students"),
    restoreFn: (id, userId) => studentUseCases.restoreStudentById(id, userId),
    onAfterRestore: async (user, id) => {
      await auditStudent(user, "student.restore", `Restored student ${id}`, id);
    },
    buildRestoreResponse: async (restored, user) => ({
      success: true,
      student: await sanitizeOneStudentForUser(restored as Student, user as User),
    }),
    mapRestoreError: mapStudentRestoreError,
  });

  registerSoftDeletableBulkTrashRoutes(fastify, {
    collection: "students",
    errorMessagePrefix: "students",
    bulkBodySchema: studentsBulkIdsSchema,
    canDelete: (user) => canDeleteCollection(user, "students"),
    bulkDeleteFn: (ids, user, reason) => studentUseCases.bulkSoftDeleteStudents(ids, user, reason),
    bulkRestoreFn: (ids, userId) => studentUseCases.bulkRestoreStudents(ids, userId),
    mapRestoreError: mapStudentRestoreError,
    onAfterBulkDelete: async (user, result, deletionReason) => {
      const reasonNote = deletionReason?.trim() ? ` — ${deletionReason.trim()}` : "";
      await auditStudent(
        user,
        "student.bulk_soft_delete",
        `Soft-deleted ${result.succeeded} student(s); ${result.failed} failed${reasonNote}`,
      );
    },
    onAfterBulkRestore: async (user, result) => {
      await auditStudent(
        user,
        "student.bulk_restore",
        `Restored ${result.succeeded} student(s); ${result.failed} failed`,
      );
    },
  });
};
