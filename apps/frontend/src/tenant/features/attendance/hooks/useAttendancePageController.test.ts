import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useAttendancePageController } from "./useAttendancePageController";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/tenant/hooks/useViewerRole", () => ({
  useViewerRole: () => "admin",
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: () => true }),
  useModulePermissions: () => ({
    canViewSetup: true,
    canWrite: true,
    canDelete: true,
    canRead: true,
  }),
}));

vi.mock("@/hooks/usePersistedTabState", () => ({
  usePersistedTabState: (_key: string, initial: string) => [initial, vi.fn()],
}));

vi.mock("@/tenant/features/attendance/hooks/useAttendance", () => ({
  useAttendanceRoster: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useAttendanceRecords: () => ({ data: [] }),
}));

vi.mock("@/tenant/features/attendance/hooks/useAttendancePageActions", () => ({
  useAttendancePageActions: () => ({
    messagingTarget: null,
    closeComposer: vi.fn(),
    handleMessageAttendance: vi.fn(),
    persistRecords: vi.fn(),
    handleUpdateRecord: vi.fn(),
    handleDeleteRecord: vi.fn(),
    handleRestoreRecord: vi.fn(),
    handleBulkDeleteRecords: vi.fn(),
    handleBulkRestoreRecords: vi.fn(),
  }),
}));

vi.mock("@/tenant/features/attendance/hooks/useAttendanceColumnLayout", () => ({
  useAttendanceColumnLayout: () => ({}),
}));

vi.mock("@/tenant/features/attendance/hooks/useAttendancePageTabs", () => ({
  useAttendancePageTabs: () => ({
    canWriteAttendance: true,
    canDeleteAttendance: true,
    canAnalyticsView: true,
    canSeeAttendanceAnalytics: true,
    visibleTopTabs: [],
    visibleOperationsTabs: [],
    visibleAnalyticsTabs: [],
    effectiveTab: "work",
    effectiveOpsTab: "mark",
    effectiveAnalyticsTab: "charts",
  }),
}));

vi.mock("@/hooks/useModuleShortcuts", () => ({
  useModuleShortcuts: vi.fn(),
}));

// The workspace timezone is UTC+05:00, so a device clock in UTC is one day behind after 19:00Z.
vi.mock("@/tenant/hooks/useGlobalSettings", () => ({
  useGlobalSettings: () => ({ timezone: "Asia/Karachi" }),
}));

describe("useAttendancePageController Hook", () => {
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

  it("coordinates tabs, filters, shortcuts, and actions", async () => {
    let hookResult!: ReturnType<typeof useAttendancePageController>;

    function TestComponent() {
      hookResult = useAttendancePageController();
      return null;
    }

    await act(async () => {
      const root = createRoot(container!);
      root.render(React.createElement(MemoryRouter, null, React.createElement(TestComponent)));
    });

    expect(hookResult).toBeDefined();
    expect(hookResult.effectiveTab).toBe("work");
    expect(hookResult.effectiveOpsTab).toBe("mark");
    expect(hookResult.role).toBe("admin");
  });

  it("defaults the marking day to the workspace timezone, not the device clock", async () => {
    vi.useFakeTimers();
    try {
      // 20:51Z on 13 Nov is already 01:51 on 14 Nov in the UTC+05:00 workspace.
      vi.setSystemTime(new Date("2026-11-13T20:51:00.000Z"));
      let hookResult!: ReturnType<typeof useAttendancePageController>;

      function TestComponent() {
        hookResult = useAttendancePageController();
        return null;
      }

      await act(async () => {
        const root = createRoot(container!);
        root.render(React.createElement(MemoryRouter, null, React.createElement(TestComponent)));
      });

      expect(hookResult.filters.date).toBe("2026-11-14");
    } finally {
      vi.useRealTimers();
    }
  });
});
