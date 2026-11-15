import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  can: vi.fn<(permission: string) => boolean>(() => true),
  useDashboardData: vi.fn(() => ({
    financeMetrics: undefined,
    attendanceMetrics: undefined,
    studentMetricsInactive: 0,
  })),
  effectiveModules: { finance: false, students: true, attendance: true },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/useCurrency", () => ({
  useFinanceCurrency: () => ({ formatCurrency: (value: number) => String(value) }),
}));
vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: mocks.can }),
}));
vi.mock("@/tenant/hooks/useModuleAccess", () => ({
  useModuleAccess: () => ({ effectiveModules: mocks.effectiveModules }),
}));
vi.mock("@/tenant/hooks/collections/dashboard", () => ({
  useDashboardData: mocks.useDashboardData,
  useDashboardPreferencesQuery: () => ({
    data: { lowAttendanceThreshold: 75, urgentAttendanceThreshold: 60 },
  }),
}));
vi.mock("@/lib/buildDashboardNotifications", () => ({
  buildDashboardNotifications: () => [],
}));
vi.mock("@/tenant/hooks/notifications/useNotificationReadState", () => ({
  useNotificationReadState: () => ({
    isRead: () => false,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  }),
}));
vi.mock("@/tenant/hooks/notifications/useStoredNotifications", () => ({
  useStoredNotifications: () => ({ items: [], markRead: vi.fn(), markAllRead: vi.fn() }),
}));

import { useTenantNotifications } from "./useTenantNotifications";

function renderHook(hook: () => ReturnType<typeof useTenantNotifications>) {
  let result!: ReturnType<typeof useTenantNotifications>;
  function TestComponent() {
    result = hook();
    return null;
  }
  const div = document.createElement("div");
  const root = createRoot(div);
  act(() => {
    root.render(<TestComponent />);
  });
  return { result, unmount: () => act(() => root.unmount()) };
}

describe("useTenantNotifications", () => {
  it("passes the workspace module flags and permission check to the metric fallbacks", () => {
    // Regression: the shell rendered on every page passed neither argument, so a workspace with
    // finance disabled still requested /api/finance/metrics and logged a 403 on every page.
    const { unmount } = renderHook(useTenantNotifications);

    expect(mocks.useDashboardData).toHaveBeenCalledWith(
      [],
      expect.any(String),
      mocks.effectiveModules,
      mocks.can,
    );
    unmount();
  });
});
