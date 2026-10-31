import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FacultyRecord } from "@mms/shared";

const mockGetRequestTenant = vi.fn();
const mockBroadcastCollection = vi.fn();

vi.mock("../lib/tenantContext.js", () => ({
  getRequestTenant: () => mockGetRequestTenant(),
  requireTenant: () => mockGetRequestTenant() ?? "demo",
}));

vi.mock("../db/database.js", () => ({
  runInTransaction: (cb: () => unknown) => cb(),
  runInGlobalTransaction: (cb: () => unknown) => cb(),
}));

vi.mock("../lib/livePush.js", () => ({
  broadcastCollection: (...args: unknown[]) => mockBroadcastCollection(...args),
}));

vi.mock("../faculty/use-cases/facultyWriteGuards.js", () => ({
  validateFacultyContactLink: vi.fn().mockResolvedValue({ userId: null }),
  validateFacultyDesignationLink: vi.fn().mockResolvedValue({ departmentId: "" }),
}));

import { createFaculty, updateFacultyById } from "../faculty/use-cases/facultyWriteUseCases.js";
import { prepareFacultyRecord } from "../faculty/use-cases/facultyNormalizeUseCases.js";

describe("facultyCustomDesignation - designation text mapping (catalog SSOT)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRequestTenant.mockReturnValue("demo");
  });

  it("prepareFacultyRecord strips customDesignation without dual-writing designation", () => {
    const input = {
      name: "Dr. Ahmad",
      contactId: "c-100",
      customDesignation: "Visiting Scholar",
    };

    const prepared = prepareFacultyRecord(input as never);

    expect(prepared.designation).toBeUndefined();
    expect((prepared as Record<string, unknown>).customDesignation).toBeUndefined();
  });

  it("createFaculty strips custom designation from the faculty row", async () => {
    const store = new Map<string, FacultyRecord>();
    const fakeRepo = {
      findSoftDeletedByContactId: vi.fn().mockResolvedValue(null),
      save: vi.fn(async (_tenant: string, record: FacultyRecord) => {
        store.set(String(record.id), record);
      }),
      findById: vi.fn(async (_tenant: string, id: string) => store.get(id) ?? null),
    };

    const result = await createFaculty(
      {
        contactId: "c-200",
        name: "Ustadh Bilal",
        designationId: "des-1",
        customDesignation: "Head of Arabic Department",
        employeeId: "FAC20250005",
      },
      fakeRepo as never,
    );

    expect(result.restored).toBe(false);
    expect(result.record.designation).toBeUndefined();
    expect((result.record as Record<string, unknown>).customDesignation).toBeUndefined();
    expect(fakeRepo.save).toHaveBeenCalled();
  });

  it("updateFacultyById ignores customDesignation for faculty row persistence", async () => {
    const existingFaculty: FacultyRecord = {
      id: "tch-1",
      contactId: "c-300",
      name: "Sheikh Khalid",
      status: "active",
      designation: "Instructor",
      designationId: "des-1",
      hierarchyRank: 4,
      createdAt: "2025-01-01T00:00:00Z",
      updatedAt: "2025-01-01T00:00:00Z",
    };

    const store = new Map<string, FacultyRecord>([["tch-1", existingFaculty]]);
    const fakeRepo = {
      findById: vi.fn(async (_tenant: string, id: string) => store.get(id) ?? null),
      save: vi.fn(async (_tenant: string, record: FacultyRecord) => {
        store.set(String(record.id), record);
      }),
      findSubordinates: vi.fn().mockResolvedValue([]),
    };

    const updated = await updateFacultyById(
      "tch-1",
      { customDesignation: "Senior Instructor" },
      fakeRepo as never,
    );

    expect(updated?.designation).toBe("Instructor");
    expect((updated as Record<string, unknown> | null)?.customDesignation).toBeUndefined();
  });
});
