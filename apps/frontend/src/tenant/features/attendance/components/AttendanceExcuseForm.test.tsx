import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceExcuseForm } from "./AttendanceExcuseForm";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  submit: vi.fn(),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/lib/notify", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/attachmentUpload", () => ({
  uploadAttachmentFile: vi
    .fn()
    .mockResolvedValue({ url: "/uploads/tenants/demo/attachments/a.pdf" }),
  deleteAttachmentFile: vi.fn().mockResolvedValue({ deleted: true }),
}));
vi.mock("@/tenant/hooks/collections/students", () => ({
  useStudentsContractList: () => ({
    data: { body: { students: [{ id: "std-1", name: "Amina", grNumber: "GR-1" }] } },
    isLoading: false,
    isFetching: false,
  }),
}));
vi.mock("@/tenant/features/attendance/hooks/useAttendanceLifecycle", () => ({
  useAttendanceExcuses: () => ({
    submit: { mutate: mocks.submit, isPending: false },
  }),
}));

describe("AttendanceExcuseForm", () => {
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

  async function renderForm(): Promise<void> {
    await act(async () => {
      root.render(<AttendanceExcuseForm open={true} onClose={vi.fn()} />);
    });
  }

  function saveButton(): HTMLButtonElement {
    const buttons = [...document.querySelectorAll("button")];
    const button = buttons.find((candidate) =>
      candidate.textContent?.includes("attendance.excuses.submit"),
    );
    if (!button) throw new Error("save button not found");
    return button as HTMLButtonElement;
  }

  it("renders the searched student picker, type select, date range and certificate control", async () => {
    await renderForm();

    expect(saveButton()).toBeTruthy();
    const text = document.body.textContent ?? "";
    expect(text).toContain("attendance.excuses.student");
    expect(text).toContain("attendance.excuses.type");
    expect(text).toContain("attendance.excuses.from");
    expect(text).toContain("attendance.excuses.to");
    expect(text).toContain("attendance.excuses.attach");
    expect(document.querySelector('input[type="file"]')).toBeTruthy();
  });
});
