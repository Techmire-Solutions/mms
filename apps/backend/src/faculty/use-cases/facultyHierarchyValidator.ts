import type { FacultyRepository } from "../repository/facultyRepository.js";

export class HierarchyValidationError extends Error {
  readonly statusCode = 400;
  readonly type = "validation_error";
  constructor(
    message = "Supervisor must hold a higher seniority rank (lower hierarchy rank) than the subordinate",
  ) {
    super(message);
    this.name = "HierarchyValidationError";
  }
}

export class HierarchyCycleError extends Error {
  readonly statusCode = 400;
  readonly type = "validation_error";
  constructor(
    message = "Circular reporting hierarchy detected. A faculty member cannot report to their subordinate or themselves.",
  ) {
    super(message);
    this.name = "HierarchyCycleError";
  }
}

export async function validateReportingHierarchy(
  tenant: string,
  facultyId: string | undefined,
  hierarchyRank: number,
  reportingFacultyId: string | null | undefined,
  repo: FacultyRepository,
): Promise<void> {
  if (!reportingFacultyId || !reportingFacultyId.trim()) return;
  const supervisorId = reportingFacultyId.trim();

  if (facultyId && supervisorId === String(facultyId).trim()) {
    throw new HierarchyCycleError("A faculty member cannot report to themselves");
  }

  const supervisor = await repo.findById(tenant, supervisorId);
  if (!supervisor || (supervisor as { deletedAt?: string | null }).deletedAt) {
    throw new HierarchyValidationError(
      "Specified reporting supervisor does not exist or has been deleted",
    );
  }

  const supervisorRank = (supervisor as { hierarchyRank?: number }).hierarchyRank ?? 10;
  if (supervisorRank >= hierarchyRank) {
    throw new HierarchyValidationError(
      `Supervisor (rank ${supervisorRank}) must have a higher authority level (lower rank number) than the subordinate (rank ${hierarchyRank})`,
    );
  }

  // M-1 fix: single recursive CTE replaces O(depth) sequential findById loop.
  if (facultyId) {
    const ancestors = await repo.findAncestorChain(tenant, supervisorId);
    if (ancestors.includes(facultyId)) {
      throw new HierarchyCycleError(
        "Circular reporting hierarchy detected in the supervisory chain",
      );
    }
  }
}
