import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { renderEnrollmentWorkColumnValue } from "./enrollmentWorkColumnCell";
import type { Enrollment } from "@/lib/data/enrollmentData";
import type { Student } from "@mms/shared";

const mockEnrollment: Enrollment = {
  id: "enr-1",
  studentId: "std-1",
  studentName: "Ali Hassan",
  sessionId: "ses-1",
  sessionName: "Spring 2025",
  classId: "cls-1",
  className: "Hifz Class A",
  enrolledDate: "2025-01-01T00:00:00Z",
  baseFee: 100,
  discountPct: 10,
  finalFee: 90,
  status: "confirmed",
  paymentStatus: "paid",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
} as unknown as Enrollment;

const mockStudents: Student[] = [
  {
    id: "std-1",
    name: "Ali Hassan",
    grNumber: "GR-001",
    status: "active",
    type: "student",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  } as unknown as never,
];

const mockOptions = {
  t: ((k: string) => k) as unknown as never,
  students: mockStudents,
  statusConfig: { confirmed: { label: "Confirmed", cls: "bg-success" } },
  paymentConfig: { paid: { label: "Paid", cls: "bg-success" } },
  formatCurrency: (val: number) => `$${val}`,
  emptyFallback: "—",
};

describe("renderEnrollmentWorkColumnValue Utility", () => {
  it("renders student column with GR Number", () => {
    const node = renderEnrollmentWorkColumnValue(mockEnrollment, "student", mockOptions);
    const html = renderToStaticMarkup(<div>{node}</div>);
    expect(html).toContain("Ali Hassan");
    expect(html).toContain("GR-001");
  });

  it("renders session and class columns", () => {
    const sessionNode = renderEnrollmentWorkColumnValue(mockEnrollment, "session", mockOptions);
    const classNode = renderEnrollmentWorkColumnValue(mockEnrollment, "class", mockOptions);
    expect(renderToStaticMarkup(<div>{sessionNode}</div>)).toContain("Spring 2025");
    expect(renderToStaticMarkup(<div>{classNode}</div>)).toContain("Hifz Class A");
  });

  it("renders finalFee with discount percentage", () => {
    const feeNode = renderEnrollmentWorkColumnValue(mockEnrollment, "finalFee", mockOptions);
    const html = renderToStaticMarkup(<div>{feeNode}</div>);
    expect(html).toContain("$90");
    expect(html).toContain("–10%");
  });

  it("renders status and payment badges", () => {
    const statusNode = renderEnrollmentWorkColumnValue(mockEnrollment, "status", mockOptions);
    const paymentNode = renderEnrollmentWorkColumnValue(mockEnrollment, "payment", mockOptions);
    expect(renderToStaticMarkup(<div>{statusNode}</div>)).toContain("Confirmed");
    expect(renderToStaticMarkup(<div>{paymentNode}</div>)).toContain("Paid");
  });
});
