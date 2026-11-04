import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DEFAULT_DASHBOARD_PREFERENCES, type DashboardPreferences } from "@mms/shared";

const api = vi.hoisted(() => ({
  prefsQuery: {} as Record<string, unknown>,
  widgetsQuery: {} as Record<string, unknown>,
  mutatePreferences: vi.fn(),
  preferencesMutationOptions: undefined as
    { onMutate?: (variables: { body: unknown }) => Promise<unknown> } | undefined,
  seed: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  tsrClient: {
    dashboard: {
      getPreferences: { useQuery: () => api.prefsQuery },
      getWidgets: { useQuery: () => api.widgetsQuery },
      putPreferences: {
        useMutation: (options: typeof api.preferencesMutationOptions) => {
          api.preferencesMutationOptions = options;
          return { mutate: api.mutatePreferences };
        },
      },
      putWidgets: { useMutation: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }) },
      deleteWidget: { useMutation: () => ({ mutate: vi.fn() }) },
      reorderWidgets: { useMutation: () => ({ mutate: vi.fn() }) },
    },
  },
  apiContract: { dashboard: { putWidgets: api.seed } },
}));

vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: "u-admin" } }),
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/notify", () => ({
  notify: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

vi.mock("@/lib/reports/widgetDefaults", () => ({
  buildDefaultCustomWidgets: () => [],
  getOrInitializeCustomWidgets: () => [],
  peekSeedWidgets: () => [],
  hasSeededDashboardWidgets: () => false,
  markDashboardWidgetsSeeded: vi.fn(),
  clearLegacyDashboardWidgets: vi.fn(),
}));

import {
  DASHBOARD_PREFERENCES_QUERY_KEY,
  DASHBOARD_WIDGETS_QUERY_KEY,
  DASHBOARD_SUMMARY_QUERY_KEY_ROOT,
  invalidateDashboardConfigQueries,
  seedDashboardWidgets,
  useDashboardPreferencesQuery,
  useDashboardPreferencesMutation,
  useDashboardWidgetsQuery,
} from "./useDashboardSetupConfig";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type PrefsHook = ReturnType<typeof useDashboardPreferencesQuery>;
type WidgetsHook = ReturnType<typeof useDashboardWidgetsQuery>;
let latestPrefs: PrefsHook | undefined;
let latestWidgets: WidgetsHook | undefined;

function Probe(): null {
  latestPrefs = useDashboardPreferencesQuery();
  latestWidgets = useDashboardWidgetsQuery();
  useDashboardPreferencesMutation();
  return null;
}

const fullPreferences: DashboardPreferences = {
  ...DEFAULT_DASHBOARD_PREFERENCES,
  gridMode: "compact",
  lowAttendanceThreshold: 80,
  urgentAttendanceThreshold: 55,
};

describe("useDashboardSetupConfig", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  const render = () =>
    act(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Probe />
        </QueryClientProvider>,
      );
    });

  beforeEach(() => {
    latestPrefs = undefined;
    latestWidgets = undefined;
    api.mutatePreferences.mockReset();
    api.seed.mockReset();
    api.preferencesMutationOptions = undefined;
    api.prefsQuery = { data: undefined, isSuccess: false };
    api.widgetsQuery = { data: undefined, isSuccess: false };
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    queryClient.clear();
  });

  it("normalizes a partial stored document against the typed defaults", () => {
    api.prefsQuery = {
      isSuccess: true,
      data: { body: { preferences: { gridMode: "compact" } } },
    };
    render();

    expect(latestPrefs?.data.gridMode).toBe("compact");
    expect(latestPrefs?.data.lowAttendanceThreshold).toBe(
      DEFAULT_DASHBOARD_PREFERENCES.lowAttendanceThreshold,
    );
    expect(latestPrefs?.hasLoadedPreferences).toBe(true);
  });

  it("reports preferences as not loaded when the body is missing", () => {
    api.prefsQuery = { isSuccess: true, data: { status: 200 } };
    render();

    expect(latestPrefs?.hasLoadedPreferences).toBe(false);
    expect(latestPrefs?.data).toEqual(DEFAULT_DASHBOARD_PREFERENCES);
  });

  it("distinguishes an authoritative empty widget list from an unloaded one", () => {
    render();
    expect(latestWidgets?.hasServerData).toBe(false);

    api.widgetsQuery = { isSuccess: true, data: { body: { widgets: [] } } };
    render();
    expect(latestWidgets?.hasServerData).toBe(true);
    expect(latestWidgets?.data).toEqual([]);
  });

  it("invalidates only the configuration documents, never the metrics summary", () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    invalidateDashboardConfigQueries(queryClient);

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: DASHBOARD_PREFERENCES_QUERY_KEY });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: DASHBOARD_WIDGETS_QUERY_KEY });
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: DASHBOARD_SUMMARY_QUERY_KEY_ROOT });
  });

  it("merges a partial optimistic body over the cached document", async () => {
    render();
    queryClient.setQueryData(DASHBOARD_PREFERENCES_QUERY_KEY, {
      status: 200,
      body: { success: true, preferences: fullPreferences },
    });

    await api.preferencesMutationOptions?.onMutate?.({ body: { gridMode: "comfortable" } });

    const cached = queryClient.getQueryData(DASHBOARD_PREFERENCES_QUERY_KEY) as {
      body?: { preferences?: DashboardPreferences };
    };
    expect(cached.body?.preferences).toMatchObject({
      gridMode: "comfortable",
      lowAttendanceThreshold: 80,
      urgentAttendanceThreshold: 55,
    });
  });

  it("seeds widgets through the contract client and reports the outcome", async () => {
    api.seed.mockResolvedValueOnce({ status: 200, body: { success: true, widgets: [] } });
    await expect(seedDashboardWidgets([])).resolves.toBe(true);

    api.seed.mockResolvedValueOnce({ status: 500, body: { message: "boom" } });
    await expect(seedDashboardWidgets([])).resolves.toBe(false);
  });
});
