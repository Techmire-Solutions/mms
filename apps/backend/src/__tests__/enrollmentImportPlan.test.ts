import { describe, expect, it, vi } from "vitest";

vi.mock("../enrollments/repository/enrollmentImportRepository.js", () => ({
  lookupImportStudentsBulk: vi.fn(),
  lookupImportSessionsBulk: vi.fn(),
  getHydratedSessionForImport: vi.fn(),
  lookupLiveEnrollmentPairs: vi.fn(),
}));

import {
  lookupImportStudentsBulk,
  lookupImportSessionsBulk,
  getHydratedSessionForImport,
  lookupLiveEnrollmentPairs,
} from "../enrollments/repository/enrollmentImportRepository.js";
import {
  planEnrollmentImport,
  type EnrollmentImportRow,
} from "../enrollments/use-cases/enrollmentImportPlan.js";
import type { Session } from "@mms/shared";

describe("enrollmentImportPlan", () => {
  const tenant = "test-tenant";

  const mockSession: Session = {
    id: "session-1",
    name: "2026 Academic Year",
    status: "active",
    baseFee: 1000,
    classes: [
      {
        id: "class-1",
        name: "Grade 1",
        sections: [{ id: "sec-1", name: "A" }],
      },
      {
        id: "class-2",
        name: "Grade 2",
        fee: 1200,
      },
    ],
  } as unknown as Session;

  it("plans a valid enrollment row successfully", async () => {
    vi.mocked(lookupImportStudentsBulk).mockResolvedValueOnce([
      {
        id: "s-1",
        studentId: "STU-001",
        grNumber: "GR-001",
        name: "Alice Smith",
        discountType: null,
        discountPct: null,
      },
    ]);
    vi.mocked(lookupImportSessionsBulk).mockResolvedValueOnce([
      { id: "session-1", name: "2026 Academic Year" },
    ]);
    vi.mocked(getHydratedSessionForImport).mockResolvedValueOnce(mockSession);
    vi.mocked(lookupLiveEnrollmentPairs).mockResolvedValueOnce([]);

    const rows: EnrollmentImportRow[] = [
      {
        studentId: "STU-001",
        sessionName: "2026 Academic Year",
        className: "Grade 1",
        status: "confirmed",
        enrolledDate: "2026-01-15",
      },
    ];

    const plan = await planEnrollmentImport(tenant, rows);
    expect(plan.errors).toHaveLength(0);
    expect(plan.duplicates).toBe(0);
    expect(plan.planned).toHaveLength(1);
    expect(plan.planned[0]).toMatchObject({
      rowNumber: 1,
      studentId: "s-1",
      studentName: "Alice Smith",
      status: "confirmed",
      baseFee: 1000,
      finalFee: 1000,
      sectionId: "sec-1",
      enrolledDate: "2026-01-15",
    });
  });

  it("reports an error when student is not found", async () => {
    vi.mocked(lookupImportStudentsBulk).mockResolvedValueOnce([]);
    vi.mocked(lookupImportSessionsBulk).mockResolvedValueOnce([]);
    vi.mocked(lookupLiveEnrollmentPairs).mockResolvedValueOnce([]);

    const rows: EnrollmentImportRow[] = [
      {
        studentId: "NON-EXISTENT",
        sessionName: "2026 Academic Year",
        className: "Grade 1",
      },
    ];

    const plan = await planEnrollmentImport(tenant, rows);
    expect(plan.planned).toHaveLength(0);
    expect(plan.errors).toEqual([{ row: 1, reason: "Student not found" }]);
  });

  it("reports an error when student name matches multiple students", async () => {
    vi.mocked(lookupImportStudentsBulk).mockResolvedValueOnce([
      {
        id: "s-1",
        studentId: "STU-1",
        grNumber: null,
        name: "John Doe",
        discountType: null,
        discountPct: null,
      },
      {
        id: "s-2",
        studentId: "STU-2",
        grNumber: null,
        name: "John Doe",
        discountType: null,
        discountPct: null,
      },
    ]);
    vi.mocked(lookupImportSessionsBulk).mockResolvedValueOnce([]);
    vi.mocked(lookupLiveEnrollmentPairs).mockResolvedValueOnce([]);

    const rows: EnrollmentImportRow[] = [
      {
        studentName: "John Doe",
        sessionName: "2026 Academic Year",
        className: "Grade 1",
      },
    ];

    const plan = await planEnrollmentImport(tenant, rows);
    expect(plan.planned).toHaveLength(0);
    expect(plan.errors).toEqual([
      {
        row: 1,
        reason: "Student name matches more than one student — import by studentId",
      },
    ]);
  });

  it("reports an error when session or class is not found", async () => {
    vi.mocked(lookupImportStudentsBulk).mockResolvedValueOnce([
      {
        id: "s-1",
        studentId: "STU-1",
        grNumber: null,
        name: "Alice",
        discountType: null,
        discountPct: null,
      },
    ]);
    vi.mocked(lookupImportSessionsBulk).mockResolvedValueOnce([]);
    vi.mocked(lookupLiveEnrollmentPairs).mockResolvedValueOnce([]);

    const rows: EnrollmentImportRow[] = [
      {
        studentId: "STU-1",
        sessionName: "Non-Existent Session",
        className: "Grade 1",
      },
    ];

    const plan = await planEnrollmentImport(tenant, rows);
    expect(plan.planned).toHaveLength(0);
    expect(plan.errors).toEqual([{ row: 1, reason: "Session not found" }]);
  });

  it("flags duplicate rows in the same batch", async () => {
    vi.mocked(lookupImportStudentsBulk).mockResolvedValueOnce([
      {
        id: "s-1",
        studentId: "STU-1",
        grNumber: null,
        name: "Alice",
        discountType: null,
        discountPct: null,
      },
    ]);
    vi.mocked(lookupImportSessionsBulk).mockResolvedValueOnce([
      { id: "session-1", name: "2026 Academic Year" },
    ]);
    vi.mocked(getHydratedSessionForImport).mockResolvedValue(mockSession);
    vi.mocked(lookupLiveEnrollmentPairs).mockResolvedValueOnce([]);

    const rows: EnrollmentImportRow[] = [
      { studentId: "STU-1", sessionName: "2026 Academic Year", className: "Grade 1" },
      { studentId: "STU-1", sessionName: "2026 Academic Year", className: "Grade 1" },
    ];

    const plan = await planEnrollmentImport(tenant, rows);
    expect(plan.duplicates).toBe(1);
    expect(plan.planned).toHaveLength(1);
    expect(plan.errors).toEqual([
      { row: 2, reason: "Duplicate row for the same student and session" },
    ]);
  });

  it("skips already enrolled live pairs without error", async () => {
    vi.mocked(lookupImportStudentsBulk).mockResolvedValueOnce([
      {
        id: "s-1",
        studentId: "STU-1",
        grNumber: null,
        name: "Alice",
        discountType: null,
        discountPct: null,
      },
    ]);
    vi.mocked(lookupImportSessionsBulk).mockResolvedValueOnce([
      { id: "session-1", name: "2026 Academic Year" },
    ]);
    vi.mocked(getHydratedSessionForImport).mockResolvedValue(mockSession);
    vi.mocked(lookupLiveEnrollmentPairs).mockResolvedValueOnce([
      { studentId: "s-1", sessionId: "session-1" },
    ]);

    const rows: EnrollmentImportRow[] = [
      { studentId: "STU-1", sessionName: "2026 Academic Year", className: "Grade 1" },
    ];

    const plan = await planEnrollmentImport(tenant, rows);
    expect(plan.duplicates).toBe(0);
    expect(plan.errors).toHaveLength(0);
    expect(plan.planned).toHaveLength(0); // skipped because already live
  });
});
