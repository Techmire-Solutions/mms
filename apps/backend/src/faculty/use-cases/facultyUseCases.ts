import type { FacultyRepository } from "../repository/facultyRepository.js";
import { facultyRepository } from "../repository/facultyRepositoryAdapter.js";
import * as load from "./facultyLoadUseCases.js";
import * as write from "./facultyWriteUseCases.js";
import * as softDelete from "./facultySoftDeleteUseCases.js";
import * as operation from "./facultyOperationUseCases.js";
import * as sanitize from "./facultySanitizeUseCases.js";

// Barrel — raw functions keep the repository interface as a trailing DI param.
export * from "./facultyNormalizeUseCases.js";
export * from "./facultyLoadUseCases.js";
export * from "./facultyHydrateUseCases.js";
export * from "./facultyWriteUseCases.js";
export * from "./facultySoftDeleteUseCases.js";
export * from "./facultyOperationUseCases.js";
export * from "./facultySanitizeUseCases.js";

/**
 * Composition root — binds a `FacultyRepository` to every use case.
 *
 * Production uses the default Drizzle-backed `facultyUseCases`; tests can pass a
 * fake repository to exercise use-case orchestration in isolation.
 */
export function createFacultyUseCases(repo: FacultyRepository = facultyRepository) {
  const countFaculty = (options?: Parameters<typeof load.countFaculty>[0]) =>
    load.countFaculty(options, repo);
  const loadFacultyPage = (query: Parameters<typeof load.loadFacultyPage>[0]) =>
    load.loadFacultyPage(query, repo);
  const loadFacultyById = (id: string, includeDeleted?: boolean) =>
    load.loadFacultyById(id, includeDeleted, repo);
  const loadFacultyByIds = (ids: string[]) => load.loadFacultyByIds(ids, repo);
  const isFacultyProfileDeleted = (id: string) => load.isFacultyProfileDeleted(id, repo);
  const loadFacultyLinkedContactIds = (excludeFacultyId?: string) =>
    load.loadFacultyLinkedContactIds(excludeFacultyId, repo);
  const loadFacultyCommandMetrics = () => load.loadFacultyCommandMetrics(repo);
  const loadFacultyWidgetAggregates = (
    queries: Parameters<typeof load.loadFacultyWidgetAggregates>[0],
  ) => load.loadFacultyWidgetAggregates(queries, repo);
  const loadFacultyHierarchyTree = () => load.loadHierarchyTree(repo);
  const createFaculty = (
    record: Parameters<typeof write.createFaculty>[0],
    options?: Parameters<typeof write.createFaculty>[2],
  ) => write.createFaculty(record, repo, options);
  const updateFacultyById = (id: string, record: Parameters<typeof write.updateFacultyById>[1]) =>
    write.updateFacultyById(id, record, repo);
  const softDeleteFacultyById = (
    id: string,
    deletedBy: string,
    deletionReason?: string,
    reassignSubordinatesTo?: string,
  ) =>
    softDelete.softDeleteFacultyById(id, deletedBy, deletionReason, repo, reassignSubordinatesTo);
  const bulkSoftDeleteFaculty = (ids: string[], deletedBy: string, deletionReason?: string) =>
    softDelete.bulkSoftDeleteFaculty(ids, deletedBy, deletionReason, repo);
  const restoreFacultyById = (id: string, userId?: string) =>
    softDelete.restoreFacultyById(id, userId, repo);
  const bulkRestoreFaculty = (ids: string[], userId?: string) =>
    softDelete.bulkRestoreFaculty(ids, userId, repo);
  const bulkUpdateFacultyStatus = (ids: string[], status: string) =>
    operation.bulkUpdateFacultyStatus(ids, status, repo);
  const bulkUpdateFacultySpecialization = (ids: string[], specialization: string) =>
    operation.bulkUpdateFacultySpecialization(ids, specialization, repo);
  const computeNextFacultyEmployeeIdForSettings = (
    settings: Parameters<typeof operation.computeNextFacultyEmployeeIdForSettings>[0],
  ) => operation.computeNextFacultyEmployeeIdForSettings(settings, repo);
  const migrateFacultyMissingEmployeeIds = () => operation.migrateFacultyMissingEmployeeIds(repo);
  const checkFacultyRegistrationDuplicate = (
    input: Parameters<typeof operation.checkFacultyRegistrationDuplicate>[0],
  ) => operation.checkFacultyRegistrationDuplicate(input, repo);
  const sanitizeFacultyForViewer = (member: import("@mms/shared").Faculty, viewerRole: string) =>
    sanitize.sanitizeFacultyForViewer(member, viewerRole);
  const sanitizeFacultyListForViewer = (
    members: import("@mms/shared").Faculty[],
    viewerRole: string,
  ) => sanitize.sanitizeFacultyListForViewer(members, viewerRole);

  return {
    // Canonical Faculty methods
    countFaculty,
    loadFacultyPage,
    loadFacultyById,
    loadFacultyByIds,
    isFacultyProfileDeleted,
    loadFacultyLinkedContactIds,
    loadFacultyCommandMetrics,
    loadFacultyWidgetAggregates,
    loadFacultyHierarchyTree,
    createFaculty,
    updateFacultyById,
    softDeleteFacultyById,
    deleteFacultyById: softDeleteFacultyById,
    bulkSoftDeleteFaculty,
    restoreFacultyById,
    bulkRestoreFaculty,
    bulkUpdateFacultyStatus,
    bulkUpdateFacultySpecialization,
    computeNextFacultyEmployeeIdForSettings,
    migrateFacultyMissingEmployeeIds,
    checkFacultyRegistrationDuplicate,
    sanitizeFacultyForViewer,
    sanitizeFacultyListForViewer,
  };
}

export type FacultyUseCases = ReturnType<typeof createFacultyUseCases>;

/** Default Drizzle-backed use-case instance used by routes and services. */
export const facultyUseCases: FacultyUseCases = createFacultyUseCases();
