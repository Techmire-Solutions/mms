import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AttendanceRegisterExport } from "./AttendanceRegisterExport";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ mutate: vi.fn() }));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, string>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
}));
vi.mock("@/lib/notify", () => ({ notify: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api", () => ({
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

  it("explains why export is unavailable without a class", async () => {
    await act(async () => {
      root.render(<AttendanceRegisterExport date="2026-02-15" />);
    });
    expect(container.textContent).toContain("attendance.registerExport.selectClass");
  });
});
