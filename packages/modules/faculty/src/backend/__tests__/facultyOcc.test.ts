import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FacultyRepository } from "../repository/facultyRepository.js";
import { ConflictError } from "@mms/be-core/http/errors";

const saveIfVersionMatches = vi.fn();
const save = vi.fn();

vi.mock("@mms/db/client", () => ({
  runInTransaction: (callback: () => unknown) => callback(),
}));
vi.mock("@mms/be-core/http", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  getRequestTenant: () => "demo",
}));
vi.mock("@mms/be-core/realtime", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  broadcastCollection: vi.fn(),
}));
vi.mock("../deps.js", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  reconcileContactSystemTags: vi.fn(),
}));
vi.mock("@mms/be-core/audit/collection-audit", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  appendCollectionAuditInTx: vi.fn(),
}));
vi.mock("../use-cases/facultyWriteHelpers.js", () => ({
  applyFacultyWriteGuards: async (_tenant: string, record: unknown) => ({
    record,
    departmentId: null,
  }),
  defaultFacultyWriteGuards: {
    validateContactLink: vi.fn(),
    validateDesignationLink: vi.fn(),
    syncPrimaryAppointment: vi.fn(),
  },
  handleImplicitRestore: vi.fn(),
}));
vi.mock("../use-cases/facultyNormalizeUseCases.js", () => ({
  mergeFacultyPatch: (existing: Record<string, unknown>, patch: Record<string, unknown>) => ({
    ...existing,
    ...patch,
  }),
  prepareFacultyRecord: (record: unknown) => record,
}));
vi.mock("../use-cases/facultyEmployeeIdService.js", () => ({
  generateNextFacultyEmployeeId: vi.fn(),
  previewNextFacultyEmployeeId: vi.fn(),
}));

const { updateFacultyById } = await import("../use-cases/facultyWriteUseCases.js");

function repository(): FacultyRepository {
  const existing = {
    id: "f-1",
    designationId: "d-1",
    contactId: "c-1",
    deletedAt: null,
    notes: "original",
  };
  return {
    findById: async () => existing,
    save,
    saveIfVersionMatches,
  } as unknown as FacultyRepository;
}

describe("Faculty optimistic concurrency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    save.mockResolvedValue(undefined);
  });

  it("returns a 409 conflict for a stale token without falling back to an unconditional save", async () => {
    saveIfVersionMatches.mockResolvedValueOnce(false);

    await expect(
      updateFacultyById("f-1", { notes: "stale" }, repository(), {
        expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).rejects.toBeInstanceOf(ConflictError);

    expect(saveIfVersionMatches).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ id: "f-1" }),
      "2026-01-01T00:00:00.000Z",
      { syncRole: false },
    );
    expect(save).not.toHaveBeenCalled();
  });

  it("accepts the token the client read", async () => {
    saveIfVersionMatches.mockResolvedValueOnce(true);

    const saved = await updateFacultyById("f-1", { notes: "fresh" }, repository(), {
      expectedUpdatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(saved).toMatchObject({ id: "f-1", notes: "fresh" });
    expect(save).not.toHaveBeenCalled();
  });

  it("keeps the unconditional save when no token is supplied (backwards compatible)", async () => {
    const saved = await updateFacultyById("f-1", { notes: "legacy" }, repository());

    expect(saved).toMatchObject({ id: "f-1", notes: "legacy" });
    expect(save).toHaveBeenCalled();
    expect(saveIfVersionMatches).not.toHaveBeenCalled();
  });
});
