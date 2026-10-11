import { describe, it, expect, vi, beforeEach } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import {
  useOmniCommandRegistry,
  type UseOmniCommandRegistryResult,
} from "./useOmniCommandRegistry";

const mockUsePlatformPermissions = vi.fn();
vi.mock("@/platform/hooks/usePlatformPermissions", () => ({
  usePlatformPermissions: () => mockUsePlatformPermissions(),
}));

const mockUsePlatformWorkspaces = vi.fn();
vi.mock("@/platform/hooks/usePlatformWorkspaces", () => ({
  usePlatformWorkspaces: () => mockUsePlatformWorkspaces(),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "dashboard.title": "Dashboard",
        "platform.manageMadrasas": "Manage Madrasas",
        "module.reports": "Reports",
        "platform.activityLogsTitle": "Activity Logs",
        "platform.systemMaintenance": "System Maintenance",
        "platform.runDiagnosticsAction": "Run System Diagnostics",
        "platform.exportCsvAction": "Export Workspaces CSV",
      };
      return map[key] ?? key;
    },
  }),
}));

function renderRegistryHook(initialPath = "/platform/dashboard") {
  let hookResult!: UseOmniCommandRegistryResult;
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  function TestComponent() {
    hookResult = useOmniCommandRegistry();
    return null;
  }

  act(() => {
    root.render(
      <MemoryRouter initialEntries={[initialPath]}>
        <TestComponent />
      </MemoryRouter>,
    );
  });

  return {
    getResult: () => hookResult,
    cleanup: () => {
      act(() => root.unmount());
      container.remove();
    },
  };
}

describe("useOmniCommandRegistry", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockUsePlatformPermissions.mockReturnValue({
      canWorkspaces: true,
      canOnboard: true,
      canSettings: true,
      canSystem: true,
      canAdmins: true,
    });
    mockUsePlatformWorkspaces.mockReturnValue({
      data: [
        { subdomain: "alhuda", madrasaName: "Al-Huda Academy", enabled: true },
        { subdomain: "noor", madrasaName: "Noor Institute", enabled: false },
      ],
    });
  });

  it("aggregates navigation, action, and dynamic workspace commands", () => {
    const { getResult, cleanup } = renderRegistryHook();
    const items = getResult().items;

    expect(items.some((i) => i.id === "dashboard")).toBe(true);
    expect(items.some((i) => i.id === "ws-alhuda")).toBe(true);
    expect(items.some((i) => i.id === "ws-noor")).toBe(true);
    cleanup();
  });

  it("filters specifically to action commands when query begins with >", () => {
    const { getResult, cleanup } = renderRegistryHook();
    const actionItems = getResult().filterItems(">");

    expect(actionItems.length).toBeGreaterThan(0);
    expect(actionItems.every((i) => i.category === "platform.commandCategory.actions")).toBe(true);

    const exportAction = getResult().filterItems("> export");
    expect(exportAction.some((i) => i.id === "export-workspaces")).toBe(true);
    expect(exportAction.every((i) => i.category === "platform.commandCategory.actions")).toBe(true);
    cleanup();
  });

  it("records recent workspaces and presents them in recent category", () => {
    const { getResult, cleanup } = renderRegistryHook();

    act(() => {
      getResult().recordRecent({ subdomain: "alhuda", madrasaName: "Al-Huda Academy" });
    });

    const recentItems = getResult().items.filter(
      (i) => i.category === "platform.commandCategory.recent",
    );
    expect(recentItems).toHaveLength(1);
    expect(recentItems[0].customSubtitle).toBe("alhuda");
    expect(recentItems[0].badge).toBe("Recent");

    const stored = JSON.parse(localStorage.getItem("mms_platform_recent_workspaces") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].subdomain).toBe("alhuda");
    cleanup();
  });

  it("filters items by keyword and subtitle matching", () => {
    const { getResult, cleanup } = renderRegistryHook();
    const results = getResult().filterItems("diagnostics");

    expect(results.some((i) => i.id === "system-diagnostics")).toBe(true);
    cleanup();
  });
});
