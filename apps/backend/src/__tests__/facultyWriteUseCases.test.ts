import { describe, expect, it, vi } from "vitest";
import {
  applyFacultyWriteGuards,
  handleImplicitRestore,
  type FacultyWriteGuards,
} from "../faculty/use-cases/facultyWriteHelpers.js";
import type { FacultyRecord } from "@mms/shared";

function record(overrides: Partial<FacultyRecord> = {}): FacultyRecord {
  return {
    id: "fac-1",
    employeeId: "EMP-1",
    contactId: "contact-1",
    designationId: "desig-1",
    userId: null,
    ...overrides,
  } as FacultyRecord;
}

function fakeGuards(overrides: Partial<FacultyWriteGuards> = {}): FacultyWriteGuards {
  return {
    validateContactLink: vi.fn().mockResolvedValue({ userId: null }),
    validateDesignationLink: vi.fn().mockResolvedValue({ departmentId: "dept-1" }),
    syncPrimaryAppointment: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

const requirements = { requireEmail: true, requirePhone: false };

describe("faculty write guards (applyFacultyWriteGuards)", () => {
  it("requires a designation", async () => {
    const guards = fakeGuards();
    await expect(
      applyFacultyWriteGuards("demo", record({ designationId: "" }), guards, {
        designationChanged: true,
        contactChanged: false,
        contactRequirements: requirements,
      }),
    ).rejects.toThrow(/designation is required/i);
    expect(guards.validateDesignationLink).not.toHaveBeenCalled();
  });

  it("skips designation validation when the designation did not change", async () => {
    const guards = fakeGuards();
    const result = await applyFacultyWriteGuards("demo", record(), guards, {
      designationChanged: false,
      contactChanged: false,
      contactRequirements: requirements,
    });
    expect(result.departmentId).toBeNull();
    expect(guards.validateDesignationLink).not.toHaveBeenCalled();
  });

  it("attaches the registered userId when the contact links to a user", async () => {
    const guards = fakeGuards({
      validateContactLink: vi.fn().mockResolvedValue({ userId: "user-9" }),
    });
    const result = await applyFacultyWriteGuards("demo", record({ userId: null }), guards, {
      designationChanged: false,
      contactChanged: true,
      contactRequirements: requirements,
    });
    expect(result.record.userId).toBe("user-9");
    expect(guards.validateContactLink).toHaveBeenCalledWith(
      "demo",
      "contact-1",
      undefined,
      requirements,
    );
  });

  it("resolves the department from the designation when it changed", async () => {
    const guards = fakeGuards();
    const result = await applyFacultyWriteGuards("demo", record(), guards, {
      designationChanged: true,
      contactChanged: false,
      contactRequirements: requirements,
    });
    expect(result.departmentId).toBe("dept-1");
    expect(guards.validateDesignationLink).toHaveBeenCalledWith("demo", "desig-1");
  });
});

describe("faculty write helpers (handleImplicitRestore)", () => {
  it("merges archived + normalized and persists the merged record", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const archived = record({ id: "fac-1", employeeId: "EMP-1", userId: "user-1" });
    const normalized = record({ id: "fac-new", employeeId: "EMP-2" });

    const merged = await handleImplicitRestore("demo", archived, normalized, save);

    expect(merged.id).toBe("fac-1");
    expect(save).toHaveBeenCalledWith("demo", merged);
  });
});
