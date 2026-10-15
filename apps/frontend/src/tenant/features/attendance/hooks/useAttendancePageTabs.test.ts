import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useAttendancePageTabs } from "./useAttendancePageTabs";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: () => true }),
  useModulePermissions: () => ({ canWrite: true, canDelete: true, canRead: true }),
}));

vi.mock("@/tenant/hooks/useModuleTierTabs", () => ({
  useFilteredModuleTierTabs: () => [
    { id: "work", label: "Attendance" },
    { id: "reports", label: "Reports" },
    { id: "setup", label: "Setup" },
  ],
}));

describe("useAttendancePageTabs Hook", () => {
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

  it("resolves effective tab and visible tier tabs", async () => {
    let hookResult!: ReturnType<typeof useAttendancePageTabs>;

    function TestComponent() {
      hookResult = useAttendancePageTabs("work", "mark", "charts", true);
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(TestComponent));
    });

    expect(hookResult).toBeDefined();
    expect(hookResult.effectiveTab).toBe("work");
    expect(hookResult.effectiveOpsTab).toBe("mark");
    expect(hookResult.effectiveAnalyticsTab).toBe("charts");
    expect(hookResult.visibleOperationsTabs.length).toBeGreaterThan(0);
  });
});
