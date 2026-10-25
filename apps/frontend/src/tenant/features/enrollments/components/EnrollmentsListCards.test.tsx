import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentsListCards } from "./EnrollmentsListCards";
import type { Enrollment } from "@/lib/data/enrollmentData";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => false,
}));

vi.mock("@/components/app/ModuleDirectoryCards", () => ({
  ModuleDirectoryCards: ({
    items,
    renderItem,
  }: {
    items: Enrollment[];
    renderItem: (item: Enrollment) => React.ReactNode;
  }) => <div data-testid="directory-cards">{items.map((item) => renderItem(item))}</div>,
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
    className: "Hifz 1",
    enrolledDate: "2025-01-01T00:00:00Z",
    baseFee: 100,
    discountPct: 0,
    finalFee: 100,
    status: "confirmed",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  } as unknown as Enrollment,
];

describe("EnrollmentsListCards Component", () => {
  it("renders card for each enrollment item", () => {
    const html = renderToStaticMarkup(
      <EnrollmentsListCards
        viewMode="cards"
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
    expect(html).toContain("enrollments.actions.viewShort");
    expect(html).toContain('role="article"');
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('data-selected="false"');
  });

  it("renders selected card when id is in selectedIds", () => {
    const html = renderToStaticMarkup(
      <EnrollmentsListCards
        viewMode="cards"
        enrollments={mockEnrollments}
        students={[]}
        isColumnVisible={() => true}
        columnRegistry={[]}
        canSelectEnrollments={true}
        selectedIds={["enr-1"]}
        allVisibleSelected={true}
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

    expect(html).toContain('data-selected="true"');
  });
});
