import { describe, expect, it, vi } from "vitest";
import type { AttendanceRecord } from "@mms/shared";
import {
  createAttendanceForeignKeyValidators,
  type AttendanceUseCasesDependencies,
} from "../attendance/use-cases/attendanceForeignKeyValidation.js";

const TENANT = "tenant-test";

describe("attendanceForeignKeyValidation", () => {
  it("given active student and class, should validate single record successfully", async () => {
    // Arrange
    const deps: AttendanceUseCasesDependencies = {
      findStudentById: vi.fn().mockResolvedValue({ id: "student-1", deletedAt: null }),
      findSessionById: vi.fn().mockResolvedValue({ id: "class-1", deletedAt: null }),
    };
    const { validateActiveForeignKeys } = createAttendanceForeignKeyValidators(deps);
    const record: Partial<AttendanceRecord> = {
      studentId: "student-1",
      classId: "class-1",
    };

    // Act & Assert
    await expect(validateActiveForeignKeys(TENANT, record)).resolves.toBeUndefined();
    expect(deps.findStudentById).toHaveBeenCalledWith(TENANT, "student-1");
    expect(deps.findSessionById).toHaveBeenCalledWith(TENANT, "class-1");
  });

  it("given record without foreign keys, should not invoke repository lookups", async () => {
    // Arrange
    const deps: AttendanceUseCasesDependencies = {
      findStudentById: vi.fn(),
      findSessionById: vi.fn(),
    };
    const { validateActiveForeignKeys } = createAttendanceForeignKeyValidators(deps);

    // Act
    await validateActiveForeignKeys(TENANT, {});

    // Assert
    expect(deps.findStudentById).not.toHaveBeenCalled();
    expect(deps.findSessionById).not.toHaveBeenCalled();
  });

  it("given missing student, should throw 400 error when validated", async () => {
    // Arrange
    const deps: AttendanceUseCasesDependencies = {
      findStudentById: vi.fn().mockResolvedValue(null),
    };
    const { validateActiveForeignKeys } = createAttendanceForeignKeyValidators(deps);
    const record: Partial<AttendanceRecord> = { studentId: "missing-student" };

    // Act & Assert
    await expect(validateActiveForeignKeys(TENANT, record)).rejects.toMatchObject({
      message: "Referenced student is archived or does not exist",
      statusCode: 400,
    });
  });

  it("given soft-deleted student, should throw 400 error when validated", async () => {
    // Arrange
    const deps: AttendanceUseCasesDependencies = {
      findStudentById: vi.fn().mockResolvedValue({ id: "student-1", deletedAt: new Date() }),
    };
    const { validateActiveForeignKeys } = createAttendanceForeignKeyValidators(deps);
    const record: Partial<AttendanceRecord> = { studentId: "student-1" };

    // Act & Assert
    await expect(validateActiveForeignKeys(TENANT, record)).rejects.toMatchObject({
      message: "Referenced student is archived or does not exist",
      statusCode: 400,
    });
  });

  it("given missing class, should throw 400 error when validated", async () => {
    // Arrange
    const deps: AttendanceUseCasesDependencies = {
      findSessionById: vi.fn().mockResolvedValue(null),
    };
    const { validateActiveForeignKeys } = createAttendanceForeignKeyValidators(deps);
    const record: Partial<AttendanceRecord> = { classId: "missing-class" };

    // Act & Assert
    await expect(validateActiveForeignKeys(TENANT, record)).rejects.toMatchObject({
      message: "Referenced class is archived or does not exist",
      statusCode: 400,
    });
  });

  it("given soft-deleted class, should throw 400 error when validated", async () => {
    // Arrange
    const deps: AttendanceUseCasesDependencies = {
      findSessionById: vi.fn().mockResolvedValue({ id: "class-1", deletedAt: new Date() }),
    };
    const { validateActiveForeignKeys } = createAttendanceForeignKeyValidators(deps);
    const record: Partial<AttendanceRecord> = { classId: "class-1" };

    // Act & Assert
    await expect(validateActiveForeignKeys(TENANT, record)).rejects.toMatchObject({
      message: "Referenced class is archived or does not exist",
      statusCode: 400,
    });
  });

  it("given batch with active students and classes, should deduplicate and validate batch successfully", async () => {
    // Arrange
    const deps: AttendanceUseCasesDependencies = {
      findStudentsByIds: vi.fn().mockResolvedValue([
        { id: "student-1", deletedAt: null },
        { id: "student-2", deletedAt: null },
      ]),
      findSessionsByIds: vi.fn().mockResolvedValue([{ id: "class-1", deletedAt: null }]),
    };
    const { validateBatchActiveForeignKeys } = createAttendanceForeignKeyValidators(deps);
    const records: AttendanceRecord[] = [
      {
        id: "a1",
        studentId: "student-1",
        classId: "class-1",
        date: "2026-10-29",
        status: "present",
      } as AttendanceRecord,
      {
        id: "a2",
        studentId: "student-2",
        classId: "class-1",
        date: "2026-10-29",
        status: "absent",
      } as AttendanceRecord,
      {
        id: "a3",
        studentId: "student-1",
        classId: "class-1",
        date: "2026-10-29",
        status: "present",
      } as AttendanceRecord,
    ];

    // Act & Assert
    await expect(validateBatchActiveForeignKeys(TENANT, records)).resolves.toBeUndefined();
    expect(deps.findStudentsByIds).toHaveBeenCalledWith(TENANT, ["student-1", "student-2"]);
    expect(deps.findSessionsByIds).toHaveBeenCalledWith(TENANT, ["class-1"]);
  });

  it("given empty batch, should return without invoking batch lookups", async () => {
    // Arrange
    const deps: AttendanceUseCasesDependencies = {
      findStudentsByIds: vi.fn(),
      findSessionsByIds: vi.fn(),
    };
    const { validateBatchActiveForeignKeys } = createAttendanceForeignKeyValidators(deps);

    // Act
    await validateBatchActiveForeignKeys(TENANT, []);

    // Assert
    expect(deps.findStudentsByIds).not.toHaveBeenCalled();
    expect(deps.findSessionsByIds).not.toHaveBeenCalled();
  });

  it("given batch with archived student, should throw 400 error", async () => {
    // Arrange
    const deps: AttendanceUseCasesDependencies = {
      findStudentsByIds: vi.fn().mockResolvedValue([
        { id: "student-1", deletedAt: null },
        { id: "student-2", deletedAt: new Date() },
      ]),
      findSessionsByIds: vi.fn().mockResolvedValue([{ id: "class-1", deletedAt: null }]),
    };
    const { validateBatchActiveForeignKeys } = createAttendanceForeignKeyValidators(deps);
    const records: AttendanceRecord[] = [
      {
        id: "a1",
        studentId: "student-1",
        classId: "class-1",
        date: "2026-10-29",
        status: "present",
      } as AttendanceRecord,
      {
        id: "a2",
        studentId: "student-2",
        classId: "class-1",
        date: "2026-10-29",
        status: "absent",
      } as AttendanceRecord,
    ];

    // Act & Assert
    await expect(validateBatchActiveForeignKeys(TENANT, records)).rejects.toMatchObject({
      message: "Referenced student is archived or does not exist",
      statusCode: 400,
    });
  });

  it("given batch with archived class, should throw 400 error", async () => {
    // Arrange
    const deps: AttendanceUseCasesDependencies = {
      findStudentsByIds: vi.fn().mockResolvedValue([{ id: "student-1", deletedAt: null }]),
      findSessionsByIds: vi.fn().mockResolvedValue([{ id: "class-1", deletedAt: new Date() }]),
    };
    const { validateBatchActiveForeignKeys } = createAttendanceForeignKeyValidators(deps);
    const records: AttendanceRecord[] = [
      {
        id: "a1",
        studentId: "student-1",
        classId: "class-1",
        date: "2026-10-29",
        status: "present",
      } as AttendanceRecord,
    ];

    // Act & Assert
    await expect(validateBatchActiveForeignKeys(TENANT, records)).rejects.toMatchObject({
      message: "Referenced class is archived or does not exist",
      statusCode: 400,
    });
  });
});
