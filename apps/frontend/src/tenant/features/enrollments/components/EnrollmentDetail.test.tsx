import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EnrollmentDetail } from "./EnrollmentDetail";
import type { Enrollment } from "@/lib/data/enrollmentData";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useCurrency", () => ({
  useFinanceCurrency: () => ({
    formatCurrency: (val: number) => `$${val}`,
  }),
}));

vi.mock("@/tenant/hooks/collections/students", () => ({
  useStudentsByIds: () => ({
    data: [{ id: "std-1", name: "Ali Hassan", grNumber: "GR-001" }],
  }),
}));

vi.mock("@/tenant/features/enrollments/components/EnrollmentOperationsPanel", () => ({
  EnrollmentOperationsPanel: () => null,
}));

vi.mock("@/components/app/DetailDrawerShell", () => ({
  DetailDrawerShell: ({
    title,
    subtitle,
    headerExtra,
    headerActions,
    children,
  }: {
    title: string;
    subtitle?: string;
    headerExtra?: React.ReactNode;
    headerActions?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <div data-testid="drawer-shell">
      <h2>{title}</h2>
      <p>{subtitle}</p>
      <div data-testid="header-actions">{headerActions}</div>
      <div>{headerExtra}</div>
      <div>{children}</div>
    </div>
  ),
}));

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
  discountPct: 0,
  finalFee: 100,
  status: "confirmed",
  paymentStatus: "paid",
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
} as unknown as Enrollment;

describe("EnrollmentDetail Component", () => {
  it("renders detail drawer with student, session, and fee details", () => {
    const html = renderToStaticMarkup(
      <EnrollmentDetail
        enrollment={mockEnrollment}
        onClose={vi.fn()}
        onStatusChange={vi.fn()}
        onPaymentStatusChange={vi.fn()}
        canWrite={true}
      />,
    );

    expect(html).toContain("Ali Hassan");
    expect(html).toContain("Spring 2025");
    expect(html).toContain("Hifz Class A");
    expect(html).toContain("$100");
  });

  it("allows a pending enrollment payment to be marked paid", () => {
    const onPaymentStatusChange = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <EnrollmentDetail
          enrollment={{ ...mockEnrollment, paymentStatus: "pending" }}
          onClose={vi.fn()}
          onStatusChange={vi.fn()}
          onPaymentStatusChange={onPaymentStatusChange}
          canWrite={true}
        />,
      );
    });

    const paidButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("enrollments.payment.paid"),
    );
    expect(paidButton).toBeDefined();

    act(() => paidButton?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(onPaymentStatusChange).toHaveBeenCalledWith("enr-1", "paid");

    act(() => root.unmount());
  });

  it("hides status/payment mutators when enrollment is archived and renders restore action", () => {
    const onRestore = vi.fn();
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <EnrollmentDetail
          enrollment={{
            ...mockEnrollment,
            deletedAt: "2026-03-01T00:00:00.000Z",
            paymentStatus: "pending",
          }}
          onClose={vi.fn()}
          onStatusChange={vi.fn()}
          onPaymentStatusChange={vi.fn()}
          canWrite={true}
          canDelete={true}
          onRestore={onRestore}
        />,
      );
    });

    // Mutator buttons must NOT be present when archived
    const paidButton = Array.from(container.querySelectorAll("button")).find((button) =>
      button.textContent?.includes("enrollments.payment.paid"),
    );
    expect(paidButton).toBeUndefined();

    // Restore action button must be present in header actions
    const restoreButton = Array.from(container.querySelectorAll("button")).find(
      (button) =>
        button.getAttribute("aria-label")?.includes("restore") ||
        button.textContent?.includes("restore"),
    );
    expect(restoreButton).toBeDefined();

    act(() => root.unmount());
  });
});
