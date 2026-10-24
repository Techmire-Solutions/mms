/**
 * Faculty service seam (Clean Architecture).
 *
 * Feature module under `src/faculty/`: repository interface + Drizzle adapter
 * in `src/faculty/repository/`, orchestration use cases in `src/faculty/use-cases/`.
 */
import { facultyUseCases } from "../faculty/use-cases/facultyUseCases.js";

export const {
  createFaculty,
  updateFacultyById,
  deleteFacultyById,
  softDeleteFacultyById,
  restoreFacultyById,
  bulkSoftDeleteFaculty,
  bulkRestoreFaculty,
  bulkUpdateFacultyStatus,
  bulkUpdateFacultySpecialization,
  loadFacultyById,
  loadFacultyByIds,
  loadFacultyWidgetAggregates,
  loadFacultyPage,
  countFaculty,
  loadFacultyCommandMetrics,
  loadFacultyLinkedContactIds,
  loadFacultyHierarchyTree,
  computeNextFacultyEmployeeIdForSettings,
  migrateFacultyMissingEmployeeIds,
  checkFacultyRegistrationDuplicate,
  sanitizeFacultyForViewer,
  sanitizeFacultyListForViewer,
} = facultyUseCases;

export { facultyUseCases };
