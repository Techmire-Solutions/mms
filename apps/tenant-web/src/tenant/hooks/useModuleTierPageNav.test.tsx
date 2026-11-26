import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { BarChart2, LayoutDashboard } from "lucide-react";
import type { ModuleTierTab } from "@mms/fe-core/lib/useModuleTierTabs";

const mocks = vi.hoisted(() => ({
  activeTab: "work",
  setActiveTab: vi.fn(),
  isDesktop: true,
  visibleTabs: [] as ModuleTierTab[],
}));

vi.mock("@mms/fe-core/hooks/useMediaQuery", () => ({
  useMediaQuery: () => mocks.isDesktop,
}));

vi.mock("@mms/fe-core/lib/usePersistedTabState", () => ({
  usePersistedTabState: (_key: string, fallback: string) => [
    mocks.activeTab ?? fallback,
    mocks.setActiveTab,
  ],
}));

vi.mock("@mms/fe-core/lib/useModuleTierTabs", () => ({
  useFilteredModuleTierTabs: () => mocks.visibleTabs,
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  useModulePermissions: () => ({
    canRead: true,
    canWrite: true,
    canDelete: true,
    canExport: true,
    canImport: true,
    canReports: true,
    canManageSetup: true,
    canViewSetup: true,
  }),
}));

import { useModuleTierPageNav, type ModuleTierPageNavResult } from "./useModuleTierPageNav";

describe("useModuleTierPageNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeTab = "work";
    mocks.isDesktop = true;
    mocks.visibleTabs = [
      { id: "work", label: "Students", description: "Work", icon: LayoutDashboard },
      { id: "reports", label: "Reports", description: "Reports", icon: BarChart2 },
    ];
  });

  function runHook(defaultTab?: string): ModuleTierPageNavResult {
    let result!: ModuleTierPageNavResult;
    function Probe() {
      result = useModuleTierPageNav({
        manifest: { permissions: { read: "students.read", write: "students.write" } },
        workLabelKey: "nav.students",
        storageKey: "students_active_tab",
        ...(defaultTab !== undefined ? { defaultTab } : {}),
      });
      return null;
    }
    const root = createRoot(document.createElement("div"));
    act(() => root.render(<Probe />));
    act(() => root.unmount());
    return result;
  }

  it("reconciles collapsed mobile empty-string state back to first visible tab on desktop", () => {
    mocks.activeTab = "";
    mocks.isDesktop = true;
    expect(runHook().effectiveTab).toBe("work");

    mocks.visibleTabs = [];
    expect(runHook("overview").effectiveTab).toBe("overview");
  });

  it("preserves collapsed empty-string accordion state on mobile viewports", () => {
    mocks.activeTab = "";
    mocks.isDesktop = false;
    expect(runHook().effectiveTab).toBe("");
  });
});
