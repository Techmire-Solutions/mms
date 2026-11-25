import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkAttendanceActions } from "./MarkAttendanceActions";

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => {
      if (key === "attendance.mark.summary") return `${params?.shown} of ${params?.total} students`;
      if (key === "attendance.mark.markedProgress")
        return `${params?.marked}/${params?.total} marked`;
      return key;
    },
  }),
}));

describe("MarkAttendanceActions Component", () => {
  it("renders row summary count, marked progress, save draft and submit attendance buttons", () => {
    const html = renderToStaticMarkup(
      <MarkAttendanceActions
        totalRows={20}
        visibleRows={20}
        markedCount={15}
        isOffline={false}
        submitted={false}
        canWriteAttendance={true}
        onSaveDraft={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(html).toContain("20 of 20 students");
    expect(html).toContain("15/20 marked");
    expect(html).toContain("attendance.mark.keyboardHints");
    expect(html).toContain("attendance.mark.saveDraft");
    expect(html).toContain("attendance.mark.submitAttendance");
  });
});

describe("MarkAttendanceActions saving state", () => {
  it("disables both Save Draft and Submit while the roster save is in flight", async () => {
    /**
     * Regression: only Submit honoured `saving`, so Save Draft stayed clickable during
     * an in-flight batch and could enqueue/save a second overlapping roster.
     */
    const { act } = await import("react");
    const { createRoot } = await import("react-dom/client");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        <MarkAttendanceActions
          totalRows={3}
          visibleRows={3}
          isOffline={false}
          submitted={false}
          canWriteAttendance={true}
          saving={true}
          onSaveDraft={vi.fn()}
          onSubmit={vi.fn()}
        />,
      );
    });

    const buttons = [...container.querySelectorAll("button")];
    const saveDraft = buttons.find((button) =>
      button.textContent?.includes("attendance.mark.saveDraft"),
    );
    const submit = buttons.find((button) =>
      button.textContent?.includes("attendance.mark.submitAttendance"),
    );
    expect(saveDraft?.disabled).toBe(true);
    expect(submit?.disabled).toBe(true);

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
