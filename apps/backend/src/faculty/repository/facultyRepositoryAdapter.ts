import type { Faculty } from "@mms/shared";
import {
  bulkSaveFaculty,
  findFacultyById,
  findFacultyByIds,
  saveFaculty,
  countSubordinates,
  countSubordinatesBatch,
  findSubordinates,
  reassignSubordinates,
  findAncestorChain,
} from "../../db/repositories/facultyRepository.js";
import {
  aggregateFacultyCommandMetrics,
  bulkUpdateFacultySpecializationSql,
  bulkUpdateFacultyStatusSql,
  countFacultyActive,
  countFacultyForNextEmployeeId,
  findSoftDeletedFacultyByContactIdSql,
  findFacultyRegistrationConflictSql,
  listActiveFacultyMissingEmployeeId,
  listFacultyLinkedContactIdsSql,
  listFacultyPage,
} from "../../db/repositories/facultyRepositoryList.js";
import { aggregateFacultyWidgetQueries } from "../../db/repositories/facultyRepositoryWidgets.js";
import type { FacultyRepository } from "./facultyRepository.js";
import { guardFacultyAssignmentDependents } from "../../db/repositories/facultyDeleteGuard.js";

/**
 * Drizzle adapter for `FacultyRepository`.
 *
 * Delegates to the tenant-scoped Drizzle repository functions; the
 * interface is the contract use cases depend on (SSOT storage gateway).
 */
function createFacultyRepository(): FacultyRepository {
  return {
    countByWorkspace: (tenant, options) => countFacultyActive(tenant, options),
    listPage: (tenant, query) => listFacultyPage(tenant, query),
    findById: (tenant, id) => findFacultyById(tenant, id),
    findByIds: (tenant, ids) => findFacultyByIds(tenant, ids),
    findSoftDeletedByContactId: (tenant, contactId) =>
      findSoftDeletedFacultyByContactIdSql(tenant, contactId),
    save: (tenant, member, options) => saveFaculty(tenant, member as Faculty, options),
    guardAssignmentDependents: guardFacultyAssignmentDependents,
    bulkSave: (tenant, members) => bulkSaveFaculty(tenant, members as Faculty[]),
    aggregateCommandMetrics: (tenant, periodDays) =>
      aggregateFacultyCommandMetrics(tenant, periodDays),
    aggregateWidgetQueries: (tenant, queries) => aggregateFacultyWidgetQueries(tenant, queries),
    listLinkedContactIds: (tenant, excludeFacultyId) =>
      listFacultyLinkedContactIdsSql(tenant, excludeFacultyId),
    countNextEmployeeId: (tenant, options) => countFacultyForNextEmployeeId(tenant, options),
    listActiveMissingEmployeeId: (tenant) => listActiveFacultyMissingEmployeeId(tenant),
    findRegistrationConflict: (tenant, input) => findFacultyRegistrationConflictSql(tenant, input),
    bulkUpdateStatusSql: (tenant, ids, status) => bulkUpdateFacultyStatusSql(tenant, ids, status),
    bulkUpdateSpecializationSql: (tenant, ids, specialization) =>
      bulkUpdateFacultySpecializationSql(tenant, ids, specialization),
    countSubordinates: (tenant, supervisorId) => countSubordinates(tenant, supervisorId),
    countSubordinatesBatch: (tenant, supervisorIds) =>
      countSubordinatesBatch(tenant, supervisorIds),
    findSubordinates: (tenant, supervisorId) => findSubordinates(tenant, supervisorId),
    reassignSubordinates: (tenant, oldSupervisorId, newSupervisorId, txClient) =>
      reassignSubordinates(tenant, oldSupervisorId, newSupervisorId, txClient),
    findAncestorChain: (tenant, facultyId, maxDepth) =>
      findAncestorChain(tenant, facultyId, maxDepth),
  };
}

/** Default Drizzle-backed instance used by the production use-case layer. */
export const facultyRepository: FacultyRepository = createFacultyRepository();
