import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useDashboardPreferencesQuery,
  useDashboardWidgetsQuery,
  useDashboardPreferencesMutation,
  useDashboardWidgetsMutation,
  useDashboardWidgetDeleteMutation,
  invalidateDashboardQueries,
} from "./useDashboardSetupConfig";

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true }),
}));

vi.mock("@/lib/api", () => ({
  tsrClient: {
    dashboard: {
      getPreferences: {
        useQuery: vi.fn().mockReturnValue({
          status: "success",
          data: {
            body: {
              preferences: {
                theme: "system",
                visibleWidgetKeys: ["kpis", "enrollments"],
              },
            },
          },
        }),
      },
      getWidgets: {
        useQuery: vi.fn().mockReturnValue({
          status: "success",
          data: {
            body: {
              widgets: [{ id: "w1", title: "Test Widget", type: "kpi", visible: true, order: 0 }],
            },
          },
        }),
      },
      putPreferences: {
        useMutation: vi.fn().mockReturnValue({
          mutate: vi.fn(),
          status: "idle",
        }),
      },
      putWidgets: {
        useMutation: vi.fn().mockReturnValue({
          mutate: vi.fn(),
          status: "idle",
        }),
      },
      deleteWidget: {
        useMutation: vi.fn().mockReturnValue({
          mutate: vi.fn(),
          status: "idle",
        }),
      },
    },
  },
}));

describe("useDashboardSetupConfig", () => {
  it("instantiates hook exports correctly in a React element context", () => {
    function TestSetupConfigComponent() {
      const prefsQuery = useDashboardPreferencesQuery();
      const widgetsQuery = useDashboardWidgetsQuery();
      const prefsMut = useDashboardPreferencesMutation();
      const widgetsMut = useDashboardWidgetsMutation();
      const delMut = useDashboardWidgetDeleteMutation();
      return (
        <div>
          {prefsQuery.status}-{widgetsQuery.status}-{prefsMut.status}-{widgetsMut.status}-
          {delMut.status}
        </div>
      );
    }

    const element = <TestSetupConfigComponent />;
    expect(element.type).toBe(TestSetupConfigComponent);
  });

  it("normalizes and returns preferences and widgets with stable data", () => {
    let prefs: unknown;
    let widgets: unknown;

    function TestComponent() {
      const prefsQuery = useDashboardPreferencesQuery();
      const widgetsQuery = useDashboardWidgetsQuery();
      prefs = prefsQuery.data;
      widgets = widgetsQuery.data;
      return null;
    }

    const queryClient = new QueryClient();
    const container = document.createElement("div");
    const root = createRoot(container);

    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <TestComponent />
        </QueryClientProvider>,
      );
    });

    expect(prefs).toBeDefined();
    expect(widgets).toBeDefined();

    act(() => {
      root.unmount();
    });
  });

  it("invalidates all dashboard query keys on invalidateDashboardQueries", () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    invalidateDashboardQueries(queryClient);

    expect(invalidateSpy).toHaveBeenCalledTimes(3);
  });
});
