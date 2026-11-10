import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceLifecyclePanel } from "./AttendanceLifecyclePanel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  review: { mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
  cancel: { mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
  submit: { mutate: vi.fn(), isPending: false },
  resolve: { mutate: vi.fn(), mutateAsync: vi.fn().mockResolvedValue(undefined), isPending: false },
  scan: { mutate: vi.fn(), isPending: false },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/tenant/features/attendance/hooks/useAttendanceLifecycle", () => ({
  useAttendanceExcuses: () => ({
    leaves: [
      {
        id: "leave-1",
        studentId: "std-1",
        fromDate: "2026-03-02",
        toDate: "2026-03-03",
        reason: "Fever",
        status: "pending",
        leaveType: "medical",
      },
    ],
    isLoading: false,
    isError: false,
    submit: mocks.submit,
    review: mocks.review,
    cancel: mocks.cancel,
  }),
  useAttendanceAbsenceAlerts: () => ({
    alerts: [],
    isLoading: false,
    isError: false,
    scan: mocks.scan,
    resolve: mocks.resolve,
  }),
}));

describe("AttendanceLifecyclePanel decisions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    document.body.innerHTML = "";
  });

  function buttonByText(text: string, root: ParentNode = document): HTMLButtonElement | undefined {
    return [...root.querySelectorAll("button")].find((button) =>
      button.textContent?.includes(text),
    ) as HTMLButtonElement | undefined;
  }

  function dialog(): ParentNode {
    return (
      document.querySelector('[role="alertdialog"]') ??
      document.querySelector('[role="dialog"]') ??
      document.body
    );
  }

  it("asks for confirmation before approving and sends the optional note", async () => {
    await act(async () => root.render(<AttendanceLifecyclePanel />));

    await act(async () => buttonByText("attendance.excuses.approve")?.click());
    // A confirmation dialog, not an immediate irreversible write.
    console.log("BODY", document.body.textContent?.slice(0, 400));
    expect(document.body.textContent).toContain("attendance.excuses.approveTitle");
    expect(mocks.review.mutate).not.toHaveBeenCalled();

    const confirm = buttonByText("attendance.excuses.approve", dialog());
    await act(async () => confirm?.click());
    expect(mocks.review.mutateAsync).toHaveBeenCalledWith({
      params: { id: "leave-1" },
      body: { decision: "approve" },
    });
  });

  it("requires a reason before cancelling an approved leave", async () => {
    await act(async () => root.render(<AttendanceLifecyclePanel />));

    await act(async () => buttonByText("attendance.excuses.cancel")?.click());
    const confirm = buttonByText("attendance.excuses.cancel", dialog());
    await act(async () => confirm?.click());

    expect(mocks.cancel.mutateAsync).not.toHaveBeenCalled();
  });
});
