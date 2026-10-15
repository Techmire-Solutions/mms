import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useAttendanceColumnLayout } from "./useAttendanceColumnLayout";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/hooks/useModuleColumnLayout", () => ({
  useModuleColumnLayout: (params: {
    moduleId: string;
    tenantRegistry: Array<{ key: string; enabled: boolean }>;
  }) => ({
    moduleId: params.moduleId,
    columnRegistry: params.tenantRegistry,
    isColumnVisible: (key: string) =>
      params.tenantRegistry.some(
        (column: { key: string; enabled: boolean }) => column.key === key && column.enabled,
      ),
  }),
}));

describe("useAttendanceColumnLayout Hook", () => {
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container) {
      document.body.removeChild(container);
      container = null;
    }
  });

  it("builds attendance column layout and returns visibility checkers", async () => {
    let hookResult!: ReturnType<typeof useAttendanceColumnLayout>;

    function TestComponent() {
      hookResult = useAttendanceColumnLayout();
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult).toBeDefined();
    expect((hookResult as unknown as { moduleId: string }).moduleId).toBe("attendance");
    expect(hookResult.isColumnVisible("student")).toBe(true);
    expect(hookResult.isColumnVisible("session")).toBe(true);
    expect(
      hookResult.columnRegistry.find((column: { key: string }) => column.key === "session")?.label,
    ).toBe("attendance.columns.session");
  });
});
