import type { User } from "@mms/contracts";
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
export {
  resolveStudentAccessScope,
  isStudentInAssignedSections,
  filterStudentIdsInAssignedSections,
  type StudentAccessScope,
} from "../repository/studentScopingRepository.js";

/**
 * Composition root — binds a `StudentsRepository` to every use case.
 *
 * Production uses the default Drizzle-backed `studentUseCases`; tests can pass a
 * fake repository to exercise use-case orchestration in isolation.
 */
export function createStudentsUseCases(repo: StudentsRepository = studentsRepository) {
  return {
    countStudents: (options?: { includeDeleted?: boolean; scopedSectionIds?: string[] }) =>
      loadEntity.countStudents(options, repo),
    loadStudentsPage: (query: Parameters<typeof loadEntity.loadStudentsPage>[0]) =>
      loadEntity.loadStudentsPage(query, repo),
    loadStudentById: (id: string, includeDeleted?: boolean) =>
      loadEntity.loadStudentById(id, includeDeleted, repo),
    loadStudentsByIds: (ids: string[]) => loadEntity.loadStudentsByIds(ids, repo),
    loadStudentLinkedContactIds: (excludeStudentId?: string) =>
      loadEntity.loadStudentLinkedContactIds(excludeStudentId, repo),
    loadStudentsCommandMetrics: (
      options?: Parameters<typeof loadAggregate.loadStudentsCommandMetrics>[0],
    ) => loadAggregate.loadStudentsCommandMetrics(options, repo),
    loadStudentsWidgetAggregates: (
      queries: Parameters<typeof loadAggregate.loadStudentsWidgetAggregates>[0],
      options?: Parameters<typeof loadAggregate.loadStudentsWidgetAggregates>[1],
    ) => loadAggregate.loadStudentsWidgetAggregates(queries, options, repo),
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
    bulkUpdateStudentStatus: (ids: string[], status: string, user?: User) =>
      operation.bulkUpdateStudentStatus(ids, status, repo, user),
    bulkEnrollStudents: (input: Parameters<typeof operation.bulkEnrollStudents>[0]) =>
      operation.bulkEnrollStudents(input),
    computeNextGrNumberForDate: (
      regDate: string,
      settings: Parameters<typeof operation.computeNextGrNumberForDate>[1],
    ) => operation.computeNextGrNumberForDate(regDate, settings, repo),
    checkStudentRegistrationDuplicate: (
      input: Parameters<typeof operation.checkStudentRegistrationDuplicate>[0],
      tenantOverride?: string,
      options?: Parameters<typeof operation.checkStudentRegistrationDuplicate>[3],
    ) => operation.checkStudentRegistrationDuplicate(input, repo, tenantOverride, options),
    migrateStudentsMissingGrNumbers: (userId?: string) =>
      operation.migrateStudentsMissingGrNumbers(repo, userId),
    sanitizeStudentForViewer: (
      student: import("@mms/contracts").Student,
      viewerRole: string,
      clearance?: import("@mms/contracts").StudentClearanceOptions,
    ) => sanitize.sanitizeStudentForViewer(student, viewerRole, clearance),
    sanitizeStudentsForViewer: (
      students: import("@mms/contracts").Student[],
      viewerRole: string,
      clearance?: import("@mms/contracts").StudentClearanceOptions,
    ) => sanitize.sanitizeStudentsForViewer(students, viewerRole, clearance),
  };
}

type StudentsUseCases = ReturnType<typeof createStudentsUseCases>;

/** Default Drizzle-backed use-case instance used by routes and services. */
export const studentUseCases: StudentsUseCases = createStudentsUseCases();
