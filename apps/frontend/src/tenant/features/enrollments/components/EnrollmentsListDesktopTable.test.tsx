import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentsListDesktopTable } from "./EnrollmentsListDesktopTable";
import type { Enrollment } from "@/lib/data/enrollmentData";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/components/ui/ModuleWorkTableHeader", () => ({
  ModuleWorkTableHeader: () => (
    <thead data-testid="table-header">
      <tr>
        <th>Header</th>
      </tr>
    </thead>
  ),
}));

vi.mock("./EnrollmentRowActions", () => ({
  EnrollmentRowActions: () => <div data-testid="row-actions">Actions</div>,
}));

const mockEnrollments: Enrollment[] = [
  {
    id: "enr-1",
    studentId: "std-1",
    studentName: "Ali Hassan",
    sessionId: "ses-1",
    sessionName: "Spring 2025",
    classId: "cls-1",
    className: "Hifz Class A",
    enrolledDate: "2025-01-15T00:00:00Z",
    baseFee: 100,
    discountPct: 0,
    finalFee: 100,
    status: "confirmed",
    createdAt: "2025-01-15T00:00:00Z",
    updatedAt: "2025-01-15T00:00:00Z",
  } as unknown as Enrollment,
];

describe("EnrollmentsListDesktopTable Component", () => {
  it("renders desktop table with rows", () => {
    const html = renderToStaticMarkup(
      <EnrollmentsListDesktopTable
        viewMode="table"
        enrollments={mockEnrollments}
        students={[]}
        isColumnVisible={() => true}
        columnRegistry={[]}
        canSelectEnrollments={true}
        selectedIds={[]}
        allVisibleSelected={false}
        someVisibleSelected={false}
        canWrite={true}
        canDelete={true}
        showDeleted={false}
        statusConfig={{}}
        paymentConfig={{}}
        formatCurrency={(val) => `$${val}`}
        onView={vi.fn()}
        onCancel={vi.fn()}
        onToggleSelectAll={vi.fn()}
        onToggleSelectedEnrollment={vi.fn()}
        openComposer={vi.fn()}
      />,
    );

    expect(html).toContain("Ali Hassan");
    expect(html).toContain("Spring 2025");
    expect(html).toContain("Hifz Class A");
  });
});
