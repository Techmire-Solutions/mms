import {
  countStudentsByWorkspace,
  findStudentById,
  findStudentsByIds,
  resolveStudentsByIdentifiers,
  saveStudent,
  bulkSaveStudents,
  bulkEnrollStudents,
  bulkSoftDeleteStudentsSql,
  bulkRestoreStudentsSql,
} from "../../db/repositories/studentRepository.js";
import type { Student } from "@mms/shared";
import {
  listStudentsPage,
  aggregateStudentsCommandMetrics,
  listActiveStudentsMissingGrNumber,
  bulkUpdateStudentsStatusSql,
} from "../../db/repositories/studentRepositoryList.js";
import {
  aggregateStudentsWidgetQueries,
  listStudentLinkedContactIdsSql,
  countStudentsForNextGrNumber,
  findStudentRegistrationConflictSql,
  findActiveGrNumberOwnersSql,
  findActiveStudentIdOwnersSql,
  findSoftDeletedStudentByContactIdSql,
} from "../../db/repositories/studentRepositoryWidgets.js";
import { guardStudentSoftDelete } from "../../db/repositories/studentDeleteGuard.js";
import {
  generateNextGrNumberSql,
  generateNextGrNumberBatchSql,
  previewNextGrNumberSql,
} from "../../db/repositories/studentRepositorySequence.js";
import type { StudentsRepository } from "./studentsRepository.js";

/**
 * Drizzle adapter for `StudentsRepository`.
 *
 * Delegates to the existing tenant-scoped Drizzle repository functions; the
 * interface is the contract use cases depend on (SSOT storage gateway).
 */
function createStudentsRepository(): StudentsRepository {
  return {
    countByWorkspace: (tenant, options) => countStudentsByWorkspace(tenant, options),
    listPage: (tenant, query) => listStudentsPage(tenant, query),
    findById: (tenant, id, options) => findStudentById(tenant, id, options),
    findByIds: (tenant, ids, options) => findStudentsByIds(tenant, ids, options),
    resolveByIdentifiers: (tenant, ids, options) =>
      resolveStudentsByIdentifiers(tenant, ids, options),
    save: (tenant, student) => saveStudent(tenant, student as Student),
    bulkSave: (tenant, students) => bulkSaveStudents(tenant, students as Student[]),
    aggregateCommandMetrics: (tenant, periodDays) =>
      aggregateStudentsCommandMetrics(tenant, periodDays),
    aggregateWidgetQueries: (tenant, queries) => aggregateStudentsWidgetQueries(tenant, queries),
    listLinkedContactIds: (tenant, excludeStudentId) =>
      listStudentLinkedContactIdsSql(tenant, excludeStudentId),
    countNextGrNumber: (tenant, input) =>
      countStudentsForNextGrNumber(tenant, input.regDate, input.restartAnnually),
    previewNextGrNumber: (tenant, input) => previewNextGrNumberSql(tenant, input),
    generateNextGrNumber: (tenant, input) => generateNextGrNumberSql(tenant, input),
    generateNextGrNumberBatch: (tenant, count, input) =>
      generateNextGrNumberBatchSql(tenant, count, input),
    findRegistrationConflict: (tenant, input) => findStudentRegistrationConflictSql(tenant, input),
    findActiveGrNumberOwners: (tenant, grNumbers) => findActiveGrNumberOwnersSql(tenant, grNumbers),
    findActiveStudentIdOwners: (tenant, studentIds) =>
      findActiveStudentIdOwnersSql(tenant, studentIds),
    findSoftDeletedByContactId: (tenant, contactId) =>
      findSoftDeletedStudentByContactIdSql(tenant, contactId),
    listActiveMissingGrNumber: (tenant, options) =>
      listActiveStudentsMissingGrNumber(tenant, options),
    bulkUpdateStatusSql: (tenant, ids, status) => bulkUpdateStudentsStatusSql(tenant, ids, status),
    bulkEnroll: (tenant, studentIds, sessionIds, mode) =>
      bulkEnrollStudents(tenant, studentIds, sessionIds, mode),
    bulkSoftDelete: (tenant, ids, deletedBy, deletionReason) =>
      bulkSoftDeleteStudentsSql(tenant, ids, deletedBy, deletionReason),
    bulkRestore: (tenant, ids, userId) => bulkRestoreStudentsSql(tenant, ids, userId),
    guardDeleteDependents: (tenant, ids) => guardStudentSoftDelete(tenant, ids),
  };
}

/** Default Drizzle-backed instance used by the production use-case layer. */
export const studentsRepository: StudentsRepository = createStudentsRepository();
