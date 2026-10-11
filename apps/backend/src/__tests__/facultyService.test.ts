import { describe, expect, it } from "vitest";
import * as facultyService from "../services/facultyService.js";
import { facultyUseCases } from "../faculty/use-cases/facultyUseCases.js";

describe("facultyService seam", () => {
  it("exports facultyUseCases and re-exports bound operation methods identically", () => {
    expect(facultyService.facultyUseCases).toBe(facultyUseCases);
    expect(facultyService.createFaculty).toBe(facultyUseCases.createFaculty);
    expect(facultyService.updateFacultyById).toBe(facultyUseCases.updateFacultyById);
    expect(facultyService.deleteFacultyById).toBe(facultyUseCases.deleteFacultyById);
    expect(facultyService.softDeleteFacultyById).toBe(facultyUseCases.softDeleteFacultyById);
    expect(facultyService.restoreFacultyById).toBe(facultyUseCases.restoreFacultyById);
    expect(facultyService.bulkSoftDeleteFaculty).toBe(facultyUseCases.bulkSoftDeleteFaculty);
    expect(facultyService.bulkRestoreFaculty).toBe(facultyUseCases.bulkRestoreFaculty);
    expect(facultyService.bulkUpdateFacultyStatus).toBe(facultyUseCases.bulkUpdateFacultyStatus);
    expect(facultyService.bulkUpdateFacultySpecialization).toBe(
      facultyUseCases.bulkUpdateFacultySpecialization,
    );
    expect(facultyService.loadFacultyById).toBe(facultyUseCases.loadFacultyById);
    expect(facultyService.loadFacultyByIds).toBe(facultyUseCases.loadFacultyByIds);
    expect(facultyService.loadFacultyWidgetAggregates).toBe(
      facultyUseCases.loadFacultyWidgetAggregates,
    );
    expect(facultyService.loadFacultyPage).toBe(facultyUseCases.loadFacultyPage);
    expect(facultyService.countFaculty).toBe(facultyUseCases.countFaculty);
    expect(facultyService.loadFacultyCommandMetrics).toBe(
      facultyUseCases.loadFacultyCommandMetrics,
    );
    expect(facultyService.loadFacultyLinkedContactIds).toBe(
      facultyUseCases.loadFacultyLinkedContactIds,
    );
    expect(facultyService.loadFacultyHierarchyTree).toBe(facultyUseCases.loadFacultyHierarchyTree);
    expect(facultyService.computeNextFacultyEmployeeIdForSettings).toBe(
      facultyUseCases.computeNextFacultyEmployeeIdForSettings,
    );
    expect(facultyService.migrateFacultyMissingEmployeeIds).toBe(
      facultyUseCases.migrateFacultyMissingEmployeeIds,
    );
    expect(facultyService.checkFacultyRegistrationDuplicate).toBe(
      facultyUseCases.checkFacultyRegistrationDuplicate,
    );
    expect(facultyService.sanitizeFacultyForViewer).toBe(facultyUseCases.sanitizeFacultyForViewer);
    expect(facultyService.sanitizeFacultyListForViewer).toBe(
      facultyUseCases.sanitizeFacultyListForViewer,
    );
  });
});
