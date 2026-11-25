import { beforeEach, describe, expect, it, vi } from "vitest";
import { todayISO, type FacultyRecord } from "@mms/contracts";

const mocks = vi.hoisted(() => ({
  findPrimary: vi.fn(),
  save: vi.fn(),
  close: vi.fn(),
  timezone: { value: Intl.DateTimeFormat().resolvedOptions().timeZone },
}));

vi.mock("@mms/be-core/datetime", async (importOriginal) => ({
  ...((await importOriginal()) as Record<string, unknown>),
  workspaceTodayIso: vi.fn(async () =>
    new Intl.DateTimeFormat("en-CA", { timeZone: mocks.timezone.value }).format(new Date()),
  ),
}));

vi.mock("../repository/db/facultyAssignmentRepository.js", () => ({
  findPrimaryFacultyAssignment: mocks.findPrimary,
  saveFacultyAssignment: mocks.save,
  closeAssignment: mocks.close,
}));

vi.mock("../use-cases/facultyWriteGuards.js", () => ({
  validateFacultyContactLink: vi.fn(),
  validateFacultyDesignationLink: vi.fn(),
}));

import {
  applyFacultyWriteGuards,
  syncPrimaryAppointment,
  type FacultyWriteGuards,
} from "../use-cases/facultyWriteHelpers.js";

// Appointment boundaries follow the calendar-local day, not UTC.
const today = todayISO();
const record: FacultyRecord = {
  id: "fac-1",
  contactId: "c-1",
  status: "active",
  designationId: "des-2",
  designationStartDate: "2024-01-01",
  employmentStartDate: "2023-06-01",
};

function fakeGuards(): FacultyWriteGuards {
  return {
    validateContactLink: vi.fn().mockResolvedValue({ userId: "usr-9" }),
    validateDesignationLink: vi.fn().mockResolvedValue({ departmentId: "dept-1" }),
    syncPrimaryAppointment: vi.fn(),
  };
}

describe("applyFacultyWriteGuards", () => {
  it("given contact and designation changes, should validate both and attach the registered user", async () => {
    // Arrange
    const guards = fakeGuards();

    // Act
    const result = await applyFacultyWriteGuards("demo", record, guards, {
      excludeFacultyId: "fac-1",
      designationChanged: true,
      contactChanged: true,
      contactRequirements: { requireEmail: true, requirePhone: false },
    });

    // Assert
    expect(guards.validateContactLink).toHaveBeenCalledWith("demo", "c-1", "fac-1", {
      requireEmail: true,
      requirePhone: false,
    });
    expect(guards.validateDesignationLink).toHaveBeenCalledWith("demo", "des-2");
    expect(result).toEqual({ record: { ...record, userId: "usr-9" }, departmentId: "dept-1" });
  });

  it("given neither link changed, should skip the DB guards and return no department", async () => {
    // Arrange
    const guards = fakeGuards();

    // Act
    const result = await applyFacultyWriteGuards("demo", record, guards, {
      designationChanged: false,
      contactChanged: false,
      contactRequirements: { requireEmail: true, requirePhone: false },
    });

    // Assert
    expect(guards.validateContactLink).not.toHaveBeenCalled();
    expect(guards.validateDesignationLink).not.toHaveBeenCalled();
    expect(result).toEqual({ record, departmentId: null });
  });

  it("given no designationId, should reject the write", async () => {
    const guards = fakeGuards();

    await expect(
      applyFacultyWriteGuards("demo", { ...record, designationId: null }, guards, {
        designationChanged: true,
        contactChanged: false,
        contactRequirements: { requireEmail: true, requirePhone: false },
      }),
    ).rejects.toThrow("Selected designation is required");
  });

  it("rejects a create/contact-change with an empty contact link", async () => {
    const guards = fakeGuards();

    await expect(
      applyFacultyWriteGuards("demo", { ...record, contactId: "" }, guards, {
        designationChanged: true,
        contactChanged: true,
        contactRequirements: { requireEmail: true, requirePhone: false },
      }),
    ).rejects.toThrow("Contact is required");
    expect(guards.validateContactLink).not.toHaveBeenCalled();
  });
});

describe("syncPrimaryAppointment (faculty_assignments compatibility bridge)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("given no designation or department, should not touch assignments", async () => {
    // Act
    await syncPrimaryAppointment("demo", { ...record, designationId: null }, "dept-1");
    await syncPrimaryAppointment("demo", record, null);

    // Assert
    expect(mocks.findPrimary).not.toHaveBeenCalled();
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("given the primary appointment already matches, should be a no-op", async () => {
    // Arrange
    mocks.findPrimary.mockResolvedValue({
      id: "fa-1",
      designationId: "des-2",
      departmentId: "dept-1",
      startDate: "2024-01-01",
    });

    // Act
    await syncPrimaryAppointment("demo", record, "dept-1");

    // Assert
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.close).not.toHaveBeenCalled();
  });

  it("uses the workspace timezone for the appointment day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-04T23:30:00.000Z"));
    mocks.timezone.value = "Asia/Karachi";
    mocks.findPrimary.mockResolvedValue(null);
    try {
      await syncPrimaryAppointment("demo", { ...record, designationStartDate: "" }, "dept-1");

      expect(mocks.save).toHaveBeenCalledWith(
        "demo",
        expect.objectContaining({ startDate: "2026-11-05" }),
      );
    } finally {
      vi.useRealTimers();
      mocks.timezone.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
  });

  it("given no primary appointment yet, should create one starting at the designation start date", async () => {
    // Arrange
    mocks.findPrimary.mockResolvedValue(null);

    // Act
    await syncPrimaryAppointment("demo", record, "dept-1");

    // Assert
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        facultyId: "fac-1",
        departmentId: "dept-1",
        designationId: "des-2",
        startDate: "2024-01-01",
        endDate: null,
        isPrimary: true,
        status: "active",
      }),
    );
  });

  it("given a different past-dated primary appointment, should close it yesterday and open a new one carrying the position", async () => {
    // Arrange
    mocks.findPrimary.mockResolvedValue({
      id: "fa-old",
      designationId: "des-1",
      departmentId: "dept-1",
      startDate: "2023-01-01",
    });

    // Act
    await syncPrimaryAppointment("demo", { ...record, updatedBy: "usr-1" }, "dept-1");

    // Assert
    expect(mocks.close).toHaveBeenCalledWith(
      "demo",
      "fa-old",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      "usr-1",
    );
    expect(mocks.close.mock.calls[0]?.[2] < today).toBe(true);
    expect(mocks.save).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({
        designationId: "des-2",
        startDate: today,
        isPrimary: true,
      }),
    );
  });

  it("given a future-dated primary appointment, should update it in place instead of closing it", async () => {
    // Arrange
    const current = {
      id: "fa-future",
      designationId: "des-1",
      departmentId: "dept-1",
      startDate: "2999-01-01",
    };
    mocks.findPrimary.mockResolvedValue(current);

    // Act
    await syncPrimaryAppointment("demo", record, "dept-1");

    // Assert
    expect(mocks.close).not.toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledWith(
      "demo",
      expect.objectContaining({ id: "fa-future", designationId: "des-2", status: "active" }),
    );
  });
});
