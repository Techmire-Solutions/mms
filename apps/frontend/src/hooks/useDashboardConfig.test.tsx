import React, { act } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  prefsLoaded: true,
  widgetsLoaded: true,
  serverWidgets: [] as Array<Record<string, unknown>>,
  seeded: false,
  permissions: ["settings.global.write", "configuration.view"] as string[],
}));

const spies = vi.hoisted(() => ({
  putPreferences: vi.fn(),
  putWidgets: vi.fn(),
  putWidgetsAsync: vi.fn(),
  deleteWidget: vi.fn(),
  reorderWidgets: vi.fn(),
  seed: vi.fn(),
  markSeeded: vi.fn(),
  clearLegacy: vi.fn(),
  notifyUndo: vi.fn(),
}));

const PREFERENCES = vi.hoisted(() => ({
  disabledCardIds: ["card-a"],
  gridMode: "comfortable" as const,
  lowAttendanceThreshold: 80,
  urgentAttendanceThreshold: 55,
  enrollmentChartType: "area" as const,
  enrollmentChartColor: "emerald" as const,
  enrollmentChartPeriod: 6,
  revenueChartType: "bar" as const,
  revenueChartColor: "mixed",
  attendanceChartType: "bar" as const,
  attendanceChartColor: "semantic",
  hasanatChartType: "pie" as const,
  hasanatChartColor: "mixed",
}));

const SEED_WIDGET = {
  id: "seed-widget",
  title: "Seed widget",
  category: "students",
  collection: "students",
  operation: "count",
  color: "emerald",
  isPinnedToDashboard: true,
};

vi.mock("@/lib/reports/widgetDefaults", () => ({
  buildDefaultCustomWidgets: () => [],
  getOrInitializeCustomWidgets: () => [],
  peekSeedWidgets: () => [SEED_WIDGET],
  hasSeededDashboardWidgets: () => state.seeded,
  markDashboardWidgetsSeeded: () => {
    state.seeded = true;
    spies.markSeeded();
  },
  clearLegacyDashboardWidgets: () => spies.clearLegacy(),
}));

vi.mock("@/tenant/hooks/usePermissions", () => ({
  usePermissions: () => ({
    can: (permission: string) => state.permissions.includes(permission),
  }),
}));

vi.mock("@/tenant/hooks/collections/dashboard", async () => {
  const { DEFAULT_DASHBOARD_PREFERENCES } = await import("@mms/shared");
  return {
    DASHBOARD_PREFERENCES_QUERY_KEY: ["dashboard", "preferences"],
    DASHBOARD_WIDGETS_QUERY_KEY: ["dashboard", "widgets"],
    seedDashboardWidgets: spies.seed,
    useDashboardPreferencesQuery: () => ({
      data: state.prefsLoaded ? PREFERENCES : DEFAULT_DASHBOARD_PREFERENCES,
      hasLoadedPreferences: state.prefsLoaded,
    }),
    useDashboardPreferencesMutation: () => ({ mutate: spies.putPreferences }),
    useDashboardWidgetsQuery: () => ({
      data: state.widgetsLoaded ? state.serverWidgets : [],
      hasServerData: state.widgetsLoaded,
    }),
    useDashboardWidgetsMutation: () => ({
      mutate: spies.putWidgets,
      mutateAsync: spies.putWidgetsAsync,
    }),
    useDashboardWidgetDeleteMutation: () => ({ mutate: spies.deleteWidget }),
    useDashboardWidgetsReorderMutation: () => ({ mutate: spies.reorderWidgets }),
  };
});

vi.mock("@/lib/clientErrorReporting", () => ({
  reportClientError: vi.fn(),
  reportClientWarn: vi.fn(),
}));

vi.mock("@/lib/notify", () => ({
  notify: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    archivedWithUndo: spies.notifyUndo,
  },
}));

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { useDashboardConfig } from "./useDashboardConfig";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

type ConfigApi = ReturnType<typeof useDashboardConfig>;
let latestApi: ConfigApi | undefined;

function Probe(): React.JSX.Element {
  latestApi = useDashboardConfig();
  return <div />;
}

function renderTree(root: Root, queryClient: QueryClient): void {
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Probe />
      </QueryClientProvider>,
    );
  });
}

describe("useDashboardConfig", () => {
  let container: HTMLDivElement;
  let root: Root;
  let queryClient: QueryClient;

  beforeEach(() => {
    latestApi = undefined;
    state.prefsLoaded = true;
    state.widgetsLoaded = true;
    state.serverWidgets = [];
    state.seeded = false;
    state.permissions = ["settings.global.write", "configuration.view"];
    Object.values(spies).forEach((spy) => spy.mockClear());
    spies.seed.mockResolvedValue(true);
    spies.putWidgetsAsync.mockResolvedValue(undefined);
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

  it("seeds an empty server configuration exactly once for every mounted instance", async () => {
    renderTree(root, queryClient);
    renderTree(root, queryClient);

    await vi.waitFor(() => expect(spies.seed).toHaveBeenCalledTimes(1));
    expect(spies.seed).toHaveBeenCalledWith([SEED_WIDGET]);
  });

  it("marks the migration done and clears the legacy blob after seeding", async () => {
    renderTree(root, queryClient);

    await vi.waitFor(() => expect(state.seeded).toBe(true));
    expect(spies.markSeeded).toHaveBeenCalled();
    expect(spies.clearLegacy).toHaveBeenCalled();
  });

  it("never seeds again once the migration marker exists", async () => {
    state.seeded = true;
    renderTree(root, queryClient);

    await act(async () => {
      await Promise.resolve();
    });
    expect(spies.seed).not.toHaveBeenCalled();
  });

  it("does not seed a workspace that already has widgets, but retires the legacy blob", async () => {
    state.serverWidgets = [{ ...SEED_WIDGET, id: "server-widget" }];
    renderTree(root, queryClient);

    await vi.waitFor(() => expect(spies.markSeeded).toHaveBeenCalled());
    expect(spies.seed).not.toHaveBeenCalled();
    expect(spies.clearLegacy).toHaveBeenCalled();
  });

  it("attempts a failing seed only once per session instead of looping", async () => {
    spies.seed.mockResolvedValue(false);
    renderTree(root, queryClient);

    await vi.waitFor(() => expect(spies.seed).toHaveBeenCalledTimes(1));
    renderTree(root, queryClient);
    renderTree(root, queryClient);

    expect(spies.seed).toHaveBeenCalledTimes(1);
    expect(state.seeded).toBe(false);
  });

  it("refuses to save preferences before the document has loaded", async () => {
    state.prefsLoaded = false;
    renderTree(root, queryClient);

    act(() => {
      latestApi?.updatePref("gridMode", "compact");
    });

    expect(spies.putPreferences).not.toHaveBeenCalled();
    expect(latestApi?.isConfigReady).toBe(false);
  });

  it("saves the full loaded document with the changed key", async () => {
    renderTree(root, queryClient);

    act(() => {
      latestApi?.updatePref("gridMode", "compact");
    });

    expect(spies.putPreferences).toHaveBeenCalledTimes(1);
    expect(spies.putPreferences.mock.calls[0][0]).toMatchObject({
      body: { ...PREFERENCES, gridMode: "compact" },
    });
  });

  it("keeps both changes when two preferences are written in one tick", () => {
    renderTree(root, queryClient);

    act(() => {
      latestApi?.updatePref("gridMode", "compact");
      latestApi?.updatePref("disabledCardIds", ["card-b"]);
    });

    expect(spies.putPreferences).toHaveBeenCalledTimes(2);
    // The second PUT must build on the first optimistic write, not the render snapshot.
    expect(spies.putPreferences.mock.calls.at(-1)?.[0]).toMatchObject({
      body: { gridMode: "compact", disabledCardIds: ["card-b"] },
    });
  });

  it("keeps both card toggles within one tick", () => {
    renderTree(root, queryClient);

    act(() => {
      latestApi?.toggleCardVisibility("card-b");
      latestApi?.toggleCardVisibility("card-c");
    });

    expect(spies.putPreferences.mock.calls.at(-1)?.[0]?.body).toMatchObject({
      disabledCardIds: expect.arrayContaining(["card-a", "card-b", "card-c"]),
    });
  });

  it("gates widget writes on a loaded list and the write permission", async () => {
    state.serverWidgets = [{ ...SEED_WIDGET }];
    renderTree(root, queryClient);

    act(() => {
      latestApi?.unpinWidget("seed-widget");
    });
    expect(spies.putWidgets).toHaveBeenCalledWith({
      body: [{ ...SEED_WIDGET, isPinnedToDashboard: false }],
    });

    spies.putWidgets.mockClear();
    state.permissions = [];
    renderTree(root, queryClient);
    act(() => {
      latestApi?.unpinWidget("seed-widget");
      latestApi?.deleteWidget("seed-widget");
    });
    expect(spies.putWidgets).not.toHaveBeenCalled();
    expect(spies.deleteWidget).not.toHaveBeenCalled();
  });

  it("does not touch widgets while the widget list is still loading", async () => {
    state.widgetsLoaded = false;
    renderTree(root, queryClient);

    act(() => {
      latestApi?.unpinWidget("seed-widget");
      latestApi?.updateCustomWidgets([SEED_WIDGET] as never);
    });
    expect(spies.putWidgets).not.toHaveBeenCalled();
    expect(latestApi?.isConfigReady).toBe(false);
  });

  it("deletes a widget through the dedicated endpoint", async () => {
    renderTree(root, queryClient);

    act(() => {
      latestApi?.deleteWidget("w1");
    });

    expect(spies.deleteWidget.mock.calls[0]?.[0]).toEqual({ params: { id: "w1" }, body: {} });
  });

  it("offers an undo when a configured widget is deleted", async () => {
    state.serverWidgets = [{ ...SEED_WIDGET, id: "custom-1" }];
    renderTree(root, queryClient);

    act(() => {
      latestApi?.deleteWidget("custom-1");
    });

    const options = spies.deleteWidget.mock.calls[0]?.[1] as { onSuccess?: () => void } | undefined;
    expect(options?.onSuccess).toBeTypeOf("function");

    act(() => options?.onSuccess?.());

    expect(spies.notifyUndo).toHaveBeenCalledTimes(1);
    const [title, undo, undoOptions] = spies.notifyUndo.mock.calls[0] ?? [];
    expect(title).toBe("dashboard.widgetDeleted");
    expect(undoOptions).toEqual({ undoLabel: "common.undo" });

    // Undo re-upserts the deleted widget (the backend upserts by id).
    act(() => {
      void (undo as () => void)();
    });
    expect(spies.putWidgetsAsync).toHaveBeenCalledWith({
      body: [{ ...SEED_WIDGET, id: "custom-1" }],
    });
  });

  it("shows the seed set as a placeholder only until the server list loads", () => {
    state.widgetsLoaded = false;
    renderTree(root, queryClient);
    expect(latestApi?.customWidgets).toEqual([SEED_WIDGET]);

    state.widgetsLoaded = true;
    renderTree(root, queryClient);
    expect(latestApi?.customWidgets).toEqual([]);
  });
});
