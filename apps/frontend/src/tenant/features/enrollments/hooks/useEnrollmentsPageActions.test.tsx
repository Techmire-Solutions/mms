import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Enrollment } from "@/lib/data/enrollmentData";
import { notify } from "@/lib/notify";
import { useEnrollmentsPageActions } from "./useEnrollmentsPageActions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  createEnrollment: { mutateAsync: vi.fn() },
  updateEnrollment: { mutate: vi.fn() },
  deleteEnrollment: { mutate: vi.fn() },
  restoreEnrollment: { mutate: vi.fn() },
  bulkDeleteEnrollments: { mutate: vi.fn() },
  bulkRestoreEnrollments: { mutate: vi.fn() },
  updateStudent: { mutate: vi.fn() },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => (params ? `${key}:${params.status}` : key),
  }),
}));

vi.mock("@/tenant/hooks/useViewerRole", () => ({
  useEnrollmentViewerRole: () => "Admin",
}));

vi.mock("@/tenant/features/enrollments/hooks/useEnrollmentsApi", () => ({
  useEnrollmentMutations: () => mocks,
}));

vi.mock("@/tenant/hooks/collections/students", () => ({
  useStudentMutations: () => ({ updateStudent: mocks.updateStudent }),
}));

vi.mock("@/lib/api", () => ({
  apiContract: { students: { resolve: vi.fn() } },
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

function renderTestHook<T>(hook: () => T) {
  const result = { current: null as T | null };
  const container = document.createElement("div");
  const root = createRoot(container);

  function TestComponent() {
    result.current = hook();
    return null;
  }

  act(() => root.render(<TestComponent />));
  return {
    result,
    unmount: () => act(() => root.unmount()),
  };
}

const enrollment = {
  id: "enr-1",
  studentId: "std-1",
  studentName: "Ali Hassan",
  sessionId: "ses-1",
  sessionName: "Spring 2026",
  classId: "cls-1",
  className: "Hifz Class A",
  enrolledDate: "2026-09-02",
  baseFee: 100,
  discountType: "none",
  discountLabel: "",
  discountPct: 0,
  discountAmt: 0,
  finalFee: 100,
  status: "confirmed",
  paymentStatus: "pending",
  notes: "",
  timeline: [],
} satisfies Enrollment;

describe("useEnrollmentsPageActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists a payment status change and refreshes the open detail", () => {
    const onViewingChange = vi.fn();
    const { result, unmount } = renderTestHook(() =>
      useEnrollmentsPageActions({
        enrollments: [enrollment],
        viewing: enrollment,
        onViewingChange,
        onActiveSubTabChange: vi.fn(),
      }),
    );

    act(() => result.current?.handlePaymentStatusChange("enr-1", "paid"));

    expect(mocks.updateEnrollment.mutate).toHaveBeenCalledTimes(1);
    const [input, options] = mocks.updateEnrollment.mutate.mock.calls[0] as [
      { id: string; enrollment: Enrollment },
      { onSuccess: () => void },
    ];
    expect(input.id).toBe("enr-1");
    expect(input.enrollment.paymentStatus).toBe("paid");
    expect(input.enrollment.timeline?.[0]).toMatchObject({
      event: "enrollments.timeline.paymentStatusChange:paid",
      by: "Admin",
    });

    act(() => options.onSuccess());
    expect(onViewingChange).toHaveBeenCalledWith(input.enrollment);
    expect(notify.success).toHaveBeenCalledWith("enrollments.toast.updated");

    unmount();
  });
});
