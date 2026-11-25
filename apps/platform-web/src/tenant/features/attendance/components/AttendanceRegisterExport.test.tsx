import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceRegisterExport } from "./AttendanceRegisterExport";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("@mms/fe-core/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
}));
vi.mock("@mms/fe-core/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ timezone: "Asia/Karachi" }),
}));
vi.mock("@mms/fe-core/api/tsRest", () => ({
  tsrClient: {
    attendance: {
      exportMatrix: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) },
    },
  },
}));

describe("AttendanceRegisterExport", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.mutate.mockClear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("derives the range from the selected day's month", async () => {
    await act(async () => {
      root.render(<AttendanceRegisterExport classId="cls-1" date="2026-02-15" />);
    });
    const csv = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("attendance.registerExport.csv"),
    );
    await act(async () => csv?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

    expect(mocks.mutate).toHaveBeenCalledWith({
      body: { classId: "cls-1", dateFrom: "2026-02-01", dateTo: "2026-02-28", format: "csv" },
    });
    expect(container.textContent).toContain("2026-02");
  });

  it("defaults to the workspace-timezone month, not the device month", async () => {
    // 20:00Z on 31 January is already 1 February in a UTC+5 workspace.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-31T20:00:00Z"));
    try {
      await act(async () => {
        root.render(<AttendanceRegisterExport classId="cls-1" />);
      });
      expect(container.textContent).toContain("2026-02");

      const csv = [...container.querySelectorAll("button")].find((button) =>
        button.textContent?.includes("attendance.registerExport.csv"),
      );
      await act(async () => csv?.dispatchEvent(new MouseEvent("click", { bubbles: true })));

      expect(mocks.mutate).toHaveBeenCalledWith({
        body: { classId: "cls-1", dateFrom: "2026-02-01", dateTo: "2026-02-28", format: "csv" },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("explains why export is unavailable without a class", async () => {
    await act(async () => {
      root.render(<AttendanceRegisterExport date="2026-02-15" />);
    });
    expect(container.textContent).toContain("attendance.registerExport.selectClass");
  });
});
