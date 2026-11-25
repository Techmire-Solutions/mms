import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStudent } from "../use-cases/studentUseCases.js";

const mockGetRequestTenant = vi.fn(() => "demo");
const mockSave = vi.fn();
const mockFindById = vi.fn();
const mockListByWorkspace = vi.fn();
const mockBroadcast = vi.fn();

vi.mock("@mms/be-core/http", () => ({
  getRequestTenant: () => mockGetRequestTenant(),
  requireTenant: () => mockGetRequestTenant(),
}));

vi.mock("@mms/db/client", () => ({
  runInTransaction: (cb: () => unknown) => cb(),
  runInGlobalTransaction: (cb: () => unknown) => cb(),
}));

vi.mock("../repository/db/studentRepository.js", () => ({
  listStudentsByWorkspace: (...args: unknown[]) => mockListByWorkspace(...args),
  findStudentById: (...args: unknown[]) => mockFindById(...args),
  findStudentsByIds: vi.fn().mockResolvedValue([]),
  countStudentsByWorkspace: vi.fn().mockResolvedValue(0),
  saveStudent: (...args: unknown[]) => mockSave(...args),
  saveStudentInsertOnly: (...args: unknown[]) => mockSave(...args),
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
  findStudentRegistrationConflictSql: vi.fn(),
  findSoftDeletedStudentByContactIdSql: vi.fn().mockResolvedValue(null),
}));

vi.mock("@mms/be-core/realtime", () => ({
  broadcastCollection: (...args: unknown[]) => mockBroadcast(...args),
  broadcastTenantUpdate: (...args: unknown[]) => mockBroadcast(...args),
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

describe("createStudent GR unique violation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestTenant.mockReturnValue("demo");
  });

  it("maps Postgres unique_violation to statusCode 409", async () => {
    mockSave.mockRejectedValue(Object.assign(new Error("duplicate key"), { code: "23505" }));
    await expect(
      createStudent({
        contactId: "c-1",
        status: "active",
        grNumber: "GR-1",
      } as never),
    ).rejects.toMatchObject({ statusCode: 409, type: "conflict" });
  });
});
