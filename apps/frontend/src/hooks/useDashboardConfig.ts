import { useCallback, useEffect } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  DASHBOARD_MODULE_MANIFEST,
  DEFAULT_DASHBOARD_PREFERENCES,
  type DashboardPreferences,
} from "@mms/shared";
import { getOrInitializeCustomWidgets } from "@/lib/reports/widgetDefaults";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import {
  useDashboardPreferencesQuery,
  useDashboardPreferencesMutation,
  useDashboardWidgetsQuery,
  useDashboardWidgetsMutation,
  useDashboardWidgetDeleteMutation,
  useDashboardWidgetsReorderMutation,
} from "@/tenant/hooks/collections/dashboard";

/**
 * One-time local→server seed: reads the legacy browser `kpi_custom_widgets` store once
 * (lazily, cached) so existing pin customizations migrate to the server on first load,
 * and brand-new workspaces seed the server with the default widget set. Server is SSOT
 * after migration; localStorage is no longer read for display once the server has rows.
 */
let cachedMigrationSeed: CustomWidget[] | null = null;
const dashboardWidgetSeedAttempts = new WeakSet<QueryClient>();

function getMigrationSeedWidgets(): CustomWidget[] {
  if (cachedMigrationSeed === null) cachedMigrationSeed = getOrInitializeCustomWidgets();
  return cachedMigrationSeed;
}

export function useDashboardConfig() {
  const queryClient = useQueryClient();
  const prefsQuery = useDashboardPreferencesQuery();
  const widgetsQuery = useDashboardWidgetsQuery();
  const prefsMutation = useDashboardPreferencesMutation();
  const widgetsMutation = useDashboardWidgetsMutation();
  const widgetDeleteMutation = useDashboardWidgetDeleteMutation();
  const widgetsReorderMutation = useDashboardWidgetsReorderMutation();
  const { can } = usePermissions();
  const canWriteDashboard =
    can(DASHBOARD_MODULE_MANIFEST.permissions.setupWrite) ||
    can(DASHBOARD_MODULE_MANIFEST.permissions.customize);

  const prefs: DashboardPreferences = prefsQuery.data ?? DEFAULT_DASHBOARD_PREFERENCES;
  const serverWidgets = widgetsQuery.data ?? [];
  const customWidgets: CustomWidget[] =
    serverWidgets.length > 0 ? serverWidgets : getMigrationSeedWidgets();

  // One-time local→server widget seed. Runs only when the server query has settled
  // empty AND the user may write — viewers keep the local fallback (read-only display).
  useEffect(() => {
    if (widgetsQuery.status !== "success") return;
    if (serverWidgets.length > 0 || !canWriteDashboard) return;
    if (dashboardWidgetSeedAttempts.has(queryClient)) return;

    dashboardWidgetSeedAttempts.add(queryClient);
    widgetsMutation.mutate(
      { body: getMigrationSeedWidgets() },
      { onError: () => dashboardWidgetSeedAttempts.delete(queryClient) },
    );
  }, [widgetsQuery.status, serverWidgets.length, canWriteDashboard, queryClient, widgetsMutation]);

  /** Full-array upsert (visualizer pin set + bulk flows). Upsert-only — never wipes absent rows. */
  const updateCustomWidgets = (customWidgetsDraft: CustomWidget[]) => {
    widgetsMutation.mutate({ body: customWidgetsDraft });
  };

  /** Atomic widget reordering with optimistic cache update. */
  const reorderCustomWidgets = (order: Array<{ id: string; sortOrder: number }>) => {
    widgetsReorderMutation.mutate({ body: { order } });
  };

  const updatePref = useCallback(
    <K extends keyof DashboardPreferences>(key: K, value: DashboardPreferences[K]) => {
      prefsMutation.mutate({ body: { ...prefs, [key]: value } });
    },
    [prefs, prefsMutation],
  );

  const toggleCardVisibility = (cardId: string) => {
    const disabledCardIds = prefs.disabledCardIds;
    const s = new Set(disabledCardIds);
    if (s.has(cardId)) {
      s.delete(cardId);
    } else {
      s.add(cardId);
    }
    updatePref("disabledCardIds", [...s]);
  };

  /** Upsert only the affected widget (inserts new, updates existing; leaves others untouched). Resolves on success so builder flows can await before closing (§7). */
  const saveWidget = (savedWidget: CustomWidget) =>
    widgetsMutation.mutateAsync({ body: [savedWidget] });

  const toggleWidgetPin = (widgetId: string) => {
    const target = customWidgets.find((widget) => widget.id === widgetId);
    if (!target) return;
    widgetsMutation.mutate({
      body: [{ ...target, isPinnedToDashboard: !target.isPinnedToDashboard }],
    });
  };

  const unpinWidget = (widgetId: string) => {
    const target = customWidgets.find((widget) => widget.id === widgetId);
    if (!target) return;
    widgetsMutation.mutate({ body: [{ ...target, isPinnedToDashboard: false }] });
  };

  /** Hard delete via `DELETE /:id` (never bulk-wipe PUT). */
  const deleteWidget = (widgetId: string) => {
    widgetDeleteMutation.mutate({ params: { id: widgetId }, body: {} });
  };

  return {
    disabledCardIds: prefs.disabledCardIds,
    customWidgets,
    gridMode: prefs.gridMode,
    lowAttendanceThreshold: prefs.lowAttendanceThreshold,
    urgentAttendanceThreshold: prefs.urgentAttendanceThreshold,
    enrollmentChartType: prefs.enrollmentChartType,
    enrollmentChartColor: prefs.enrollmentChartColor,
    enrollmentChartPeriod: prefs.enrollmentChartPeriod,
    revenueChartType: prefs.revenueChartType,
    revenueChartColor: prefs.revenueChartColor,
    attendanceChartType: prefs.attendanceChartType,
    attendanceChartColor: prefs.attendanceChartColor,
    hasanatChartType: prefs.hasanatChartType,
    hasanatChartColor: prefs.hasanatChartColor,
    updateCustomWidgets,
    reorderCustomWidgets,
    toggleCardVisibility,
    toggleWidgetPin,
    unpinWidget,
    deleteWidget,
    saveWidget,
    updatePref,
    canPin: canWriteDashboard,
  };
}
