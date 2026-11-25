import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStudent } from "../use-cases/studentUseCases.js";
import { StudentPermissionError } from "../use-cases/studentNormalizeUseCases.js";

const mockGetRequestTenant = vi.fn(() => "demo");
const mockSave = vi.fn();
const mockFindSoftDeletedByContactId = vi.fn();

vi.mock("@mms/be-core/http", () => ({
  getRequestTenant: () => mockGetRequestTenant(),
  requireTenant: () => mockGetRequestTenant(),
}));

vi.mock("@mms/db/client", () => ({
  runInTransaction: (cb: () => unknown) => cb(),
  runInGlobalTransaction: (cb: () => unknown) => cb(),
  activeDb: () => ({}),
}));

vi.mock("../repository/db/studentEnrollmentCascade.js", () => ({
  cascadeSoftDeleteEnrollmentsForStudents: vi.fn().mockResolvedValue(undefined),
  restoreCascadedEnrollmentsForStudents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../repository/db/studentRepository.js", () => ({
  listStudentsByWorkspace: vi.fn(),
  findStudentById: vi.fn(),
  findStudentsByIds: vi.fn().mockResolvedValue([]),
  countStudentsByWorkspace: vi.fn().mockResolvedValue(0),
  saveStudent: (...args: unknown[]) => mockSave(...args),
  bulkSaveStudents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../repository/db/studentRepositoryList.js", () => ({
  listStudentsPage: vi.fn(),
  aggregateStudentsCommandMetrics: vi.fn(),
  listActiveStudentsMissingGrNumber: vi.fn(),
  bulkUpdateStudentsStatusSql: vi.fn(),
}));

vi.mock("../repository/db/studentRepositoryWidgets.js", () => ({
  aggregateStudentsWidgetQueries: vi.fn(),
  listStudentLinkedContactIdsSql: vi.fn(),
  countStudentsForNextGrNumber: vi.fn(),
  findStudentRegistrationConflictSql: vi.fn().mockResolvedValue(null),
  findSoftDeletedStudentByContactIdSql: (...args: unknown[]) =>
    mockFindSoftDeletedByContactId(...args),
}));

vi.mock("@mms/be-core/realtime", () => ({
  broadcastCollection: vi.fn(),
  broadcastTenantUpdate: vi.fn(),
}));

vi.mock("../deps.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../deps.js")>()),
  ...{
    loadContactsByIds: vi.fn().mockResolvedValue([]),
  },
  ...{
    loadContactsByIds: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../use-cases/studentPreferencesService.js", () => ({
  loadStudentModulePreferences: vi.fn().mockResolvedValue({}),
}));

vi.mock("@mms/be-core/data/outbox", () => ({
  emitOutboxEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@mms/be-core/audit", () => ({
  recordModernAuditEvent: vi.fn().mockResolvedValue({ id: 1 }),
  sanitizeAuditState: (v: unknown) => v,
}));

describe("createStudent restore-on-create permission gate", () => {
  const admin = { id: "u-admin", role: "admin" };
  const teacher = { id: "u-teacher", role: "teacher" };
  const archived = {
    id: "s-archived",
    contactId: "c-1",
    status: "active",
    deletedAt: "2026-01-01T00:00:00.000Z",
    deletedBy: "u-admin",
    deletionReason: "archived",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestTenant.mockReturnValue("demo");
    mockFindSoftDeletedByContactId.mockResolvedValue(archived);
  });

  it("throws StudentPermissionError when a write-only user re-registers an archived student", async () => {
    await expect(
      createStudent({ contactId: "c-1", status: "active" } as never, { user: teacher } as never),
    ).rejects.toBeInstanceOf(StudentPermissionError);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("throws StudentPermissionError when restore-on-create has no user (fail closed)", async () => {
    await expect(
      createStudent({ contactId: "c-1", status: "active" } as never),
    ).rejects.toBeInstanceOf(StudentPermissionError);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it("restores the archived student when the user has delete permission", async () => {
    const result = await createStudent(
      { contactId: "c-1", status: "active", grNumber: "GR-1" } as never,
      { user: admin } as never,
    );
    expect(result.restored).toBe(true);
    expect(result.record.id).toBe("s-archived");
    expect(mockSave).toHaveBeenCalledTimes(1);
  });
});
