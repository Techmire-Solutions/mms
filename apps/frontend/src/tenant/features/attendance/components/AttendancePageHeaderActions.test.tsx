import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AttendancePageHeaderActions } from "./AttendancePageHeaderActions";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

describe("AttendancePageHeaderActions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it("renders Export but not Import while the import runner is unavailable", () => {
    const onExport = vi.fn();
    const onImport = vi.fn();

    act(() => {
      root.render(
        <AttendancePageHeaderActions
          canWrite={true}
          canExport={true}
          showDeleted={false}
          onMarkAttendance={vi.fn()}
          onImport={onImport}
          onExport={onExport}
        />,
      );
    });

    const exportBtn = container.querySelector("button:has(svg.lucide-download)");
    // `POST /api/attendance/import` has no runner and always answers 503, so the action is not offered.
    const importBtn = container.querySelector("button:has(svg.lucide-upload)");
    expect(exportBtn).toBeTruthy();
    expect(importBtn).toBeNull();

    exportBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onExport).toHaveBeenCalled();
  });
});
