import { describe, expect, it, vi } from "vitest";
import {
  mapEnrollmentRow,
  resolveStudentReportExportRows,
  resolveEnrollmentReportExportRows,
  fetchAllEnrollmentsForQuery,
} from "./studentReportExport";
import type { Enrollment, Session, StudentRecord } from "@mms/shared";

vi.mock("@/tenant/hooks/collections/students", () => ({
  fetchAllStudentsForQuery: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  apiContract: {
    enrollments: {
      list: vi.fn(),
    },
  },
}));

import { fetchAllStudentsForQuery } from "@/tenant/hooks/collections/students";
import { apiContract } from "@/lib/api";

describe("studentReportExport", () => {
  it("maps enrollment row correctly", () => {
    const mockEnrollment = {
      id: "enr-1",
      studentId: "std-1",
      studentName: "Ali Ahmad",
      sessionId: "sess-1",
      sessionName: "2026-2027",
      classId: "cls-1",
      className: "Class A",
      enrolledDate: "2026-01-15",
      status: "confirmed" as const,
    } as Enrollment;

    const row = mapEnrollmentRow(mockEnrollment);
    expect(row.id).toBe("enr-1");
    expect(row.studentName).toBe("Ali Ahmad");
    expect(row.class).toBe("Class A");
    expect(row.status).toBe("confirmed");
  });

  it("resolves student report export rows with session mapping", async () => {
    const mockStudentRecords: StudentRecord[] = [
      {
        id: "std-1",
        name: "Fatima Zahra",
        gender: "female",
        status: "active",
        city: "Lahore",
        dob: "2010-05-15",
        contactId: undefined,
        fatherContactId: undefined,
        motherContactId: undefined,
        guardianContactId: undefined,
      },
    ];

    vi.mocked(fetchAllStudentsForQuery).mockResolvedValueOnce(mockStudentRecords);

    const mockSessions = [
      {
        id: "sess-1",
        name: "Hifz Morning",
        code: "HM-1",
        status: "active",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        classes: [{ id: "cls-1", name: "Tajweed 1" }],
      },
    ] as unknown as Session[];

    const result = await resolveStudentReportExportRows({
      search: "Fatima",
      sessions: mockSessions,
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("std-1");
    expect(result[0].name).toBe("Fatima Zahra");
    expect(result[0].gender).toBe("female");
  });

  it("pages through enrollments until hasMore is false", async () => {
    const page1Enrollment = {
      id: "enr-1",
      studentId: "std-1",
      studentName: "Student 1",
      sessionId: "sess-1",
      sessionName: "Session 1",
      classId: "cls-1",
      className: "Class 1",
      enrolledDate: "2026-01-01",
      status: "confirmed" as const,
    } as Enrollment;

    const page2Enrollment = {
      id: "enr-2",
      studentId: "std-2",
      studentName: "Student 2",
      sessionId: "sess-1",
      sessionName: "Session 1",
      classId: "cls-1",
      className: "Class 1",
      enrolledDate: "2026-01-02",
      status: "confirmed" as const,
    } as Enrollment;

    vi.mocked(apiContract.enrollments.list)
      .mockResolvedValueOnce({
        status: 200,
        body: { enrollments: [page1Enrollment], hasMore: true },
        headers: new Headers(),
      } as any)
      .mockResolvedValueOnce({
        status: 200,
        body: { enrollments: [page2Enrollment], hasMore: false },
        headers: new Headers(),
      } as any);

    const result = await fetchAllEnrollmentsForQuery({ search: "test" });
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("enr-1");
    expect(result[1].id).toBe("enr-2");
  });

  it("resolves enrollment report export rows", async () => {
    const mockEnrollment = {
      id: "enr-1",
      studentId: "std-1",
      studentName: "Student 1",
      sessionId: "sess-1",
      sessionName: "Session 1",
      classId: "cls-1",
      className: "Class 1",
      enrolledDate: "2026-01-01",
      status: "confirmed" as const,
    } as Enrollment;

    vi.mocked(apiContract.enrollments.list).mockResolvedValueOnce({
      status: 200,
      body: { enrollments: [mockEnrollment], hasMore: false },
      headers: new Headers(),
    } as any);

    const rows = await resolveEnrollmentReportExportRows({ search: "Student" });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("enr-1");
  });
});
