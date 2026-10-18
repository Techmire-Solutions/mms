import type { StudentsRepository } from "../repository/studentsRepository.js";
import { studentsRepository } from "../repository/studentsRepositoryAdapter.js";
import * as loadEntity from "./studentLoadEntityUseCases.js";
import * as loadAggregate from "./studentLoadAggregateUseCases.js";
import * as write from "./studentWriteUseCases.js";
import * as softDelete from "./studentSoftDeleteUseCases.js";
import * as restore from "./studentRestoreUseCases.js";
import * as operation from "./studentOperationUseCases.js";
import * as sanitize from "./studentSanitizeUseCases.js";

// Barrel — raw functions keep the repository interface as a trailing DI param.
export * from "./studentNormalizeUseCases.js";
export * from "./studentLoadEntityUseCases.js";
export * from "./studentLoadAggregateUseCases.js";
export * from "./studentHydrateUseCases.js";
export * from "./studentWriteUseCases.js";
export * from "./studentSoftDeleteUseCases.js";
export * from "./studentRestoreUseCases.js";
export * from "./studentOperationUseCases.js";
export * from "./studentSanitizeUseCases.js";

/**
 * Composition root — binds a `StudentsRepository` to every use case.
 *
 * Production uses the default Drizzle-backed `studentUseCases`; tests can pass a
 * fake repository to exercise use-case orchestration in isolation.
 */
export function createStudentsUseCases(repo: StudentsRepository = studentsRepository) {
  return {
    countStudents: (options?: { includeDeleted?: boolean }) =>
      loadEntity.countStudents(options, repo),
    loadStudentsPage: (query: Parameters<typeof loadEntity.loadStudentsPage>[0]) =>
      loadEntity.loadStudentsPage(query, repo),
    loadStudentById: (id: string, includeDeleted?: boolean) =>
      loadEntity.loadStudentById(id, includeDeleted, repo),
    loadStudentsByIds: (ids: string[]) => loadEntity.loadStudentsByIds(ids, repo),
    loadStudentLinkedContactIds: (excludeStudentId?: string) =>
      loadEntity.loadStudentLinkedContactIds(excludeStudentId, repo),
    loadStudentsCommandMetrics: () => loadAggregate.loadStudentsCommandMetrics(repo),
    loadStudentsWidgetAggregates: (
      queries: Parameters<typeof loadAggregate.loadStudentsWidgetAggregates>[0],
    ) => loadAggregate.loadStudentsWidgetAggregates(queries, repo),
    createStudent: (
      record: Parameters<typeof write.createStudent>[0],
      options?: Parameters<typeof write.createStudent>[1],
    ) => write.createStudent(record, options, repo),
    updateStudentById: (
      id: string,
      record: Parameters<typeof write.updateStudentById>[1],
      options?: Parameters<typeof write.updateStudentById>[2],
    ) => write.updateStudentById(id, record, options, repo),
    softDeleteStudentById: (id: string, deletedBy: string, deletionReason?: string) =>
      softDelete.softDeleteStudentById(id, deletedBy, deletionReason, repo),
    bulkSoftDeleteStudents: (ids: string[], deletedBy: string, deletionReason?: string) =>
      softDelete.bulkSoftDeleteStudents(ids, deletedBy, deletionReason, repo),
    restoreStudentById: (id: string, userId?: string) =>
      restore.restoreStudentById(id, userId, repo),
    bulkRestoreStudents: (ids: string[], userId?: string) =>
      restore.bulkRestoreStudents(ids, userId, repo),
    bulkUpdateStudentStatus: (ids: string[], status: string) =>
      operation.bulkUpdateStudentStatus(ids, status, repo),
    bulkEnrollStudents: (input: Parameters<typeof operation.bulkEnrollStudents>[0]) =>
      operation.bulkEnrollStudents(input),
    computeNextGrNumberForDate: (
      regDate: string,
      settings: Parameters<typeof operation.computeNextGrNumberForDate>[1],
    ) => operation.computeNextGrNumberForDate(regDate, settings, repo),
    checkStudentRegistrationDuplicate: (
      input: Parameters<typeof operation.checkStudentRegistrationDuplicate>[0],
      tenantOverride?: string,
    ) => operation.checkStudentRegistrationDuplicate(input, repo, tenantOverride),
    migrateStudentsMissingGrNumbers: (userId?: string) =>
      operation.migrateStudentsMissingGrNumbers(repo, userId),
    sanitizeStudentForViewer: (student: import("@mms/shared").Student, viewerRole: string) =>
      sanitize.sanitizeStudentForViewer(student, viewerRole),
    sanitizeStudentsForViewer: (students: import("@mms/shared").Student[], viewerRole: string) =>
      sanitize.sanitizeStudentsForViewer(students, viewerRole),
  };
}

type StudentsUseCases = ReturnType<typeof createStudentsUseCases>;

/** Default Drizzle-backed use-case instance used by routes and services. */
export const studentUseCases: StudentsUseCases = createStudentsUseCases();
