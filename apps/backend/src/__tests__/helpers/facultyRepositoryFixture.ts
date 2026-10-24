import { vi } from "vitest";
import type { FacultyRepository } from "../../faculty/repository/facultyRepository.js";

export function facultyRepositoryFixture(): FacultyRepository {
  return {
    countByWorkspace: vi.fn().mockResolvedValue(0),
    listPage: vi
      .fn()
      .mockResolvedValue({ faculty: [], total: 0, page: 1, limit: 100, hasMore: false }),
    findById: vi.fn().mockResolvedValue(null),
    findByIds: vi.fn().mockResolvedValue([]),
    findSoftDeletedByContactId: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
    bulkSave: vi.fn().mockResolvedValue(undefined),
    guardAssignmentDependents: vi.fn().mockResolvedValue(undefined),
    aggregateCommandMetrics: vi.fn(),
    aggregateWidgetQueries: vi.fn().mockResolvedValue({}),
    listLinkedContactIds: vi.fn().mockResolvedValue([]),
    countNextEmployeeId: vi.fn().mockResolvedValue(0),
    listActiveMissingEmployeeId: vi.fn().mockResolvedValue([]),
    findRegistrationConflict: vi.fn().mockResolvedValue(null),
    bulkUpdateStatusSql: vi.fn().mockResolvedValue(0),
    bulkUpdateSpecializationSql: vi.fn().mockResolvedValue(0),
    countSubordinates: vi.fn().mockResolvedValue(0),
    countSubordinatesBatch: vi.fn().mockResolvedValue({}),
    findSubordinates: vi.fn().mockResolvedValue([]),
    reassignSubordinates: vi.fn().mockResolvedValue(0),
    findAncestorChain: vi.fn().mockResolvedValue([]),
  };
}
