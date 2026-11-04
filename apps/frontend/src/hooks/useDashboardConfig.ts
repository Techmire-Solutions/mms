import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  DASHBOARD_MODULE_MANIFEST,
  DEFAULT_DASHBOARD_PREFERENCES,
  type DashboardPreferences,
} from "@mms/shared";
import {
  clearLegacyDashboardWidgets,
  hasSeededDashboardWidgets,
  markDashboardWidgetsSeeded,
  peekSeedWidgets,
} from "@/lib/reports/widgetDefaults";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import { reportClientError, reportClientWarn } from "@/lib/clientErrorReporting";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import {
  DASHBOARD_PREFERENCES_QUERY_KEY,
  DASHBOARD_WIDGETS_QUERY_KEY,
  seedDashboardWidgets,
  useDashboardPreferencesQuery,
  useDashboardPreferencesMutation,
  useDashboardWidgetsQuery,
  useDashboardWidgetsMutation,
  useDashboardWidgetDeleteMutation,
  useDashboardWidgetsReorderMutation,
} from "@/tenant/hooks/collections/dashboard";

/**
 * Query-clients that already attempted the one-time widget seed in this session.
 * Several components mount `useDashboardConfig` at once (the dashboard controller
 * and the pinned-widget grid), so the guard must span instances — and it must
 * survive a failed attempt to avoid a retry loop.
 */
const dashboardSeedAttempts = new WeakSet<QueryClient>();

/**
 * Dashboard layout/widget configuration (server-authoritative).
 *
 * Two invariants matter here:
 *  1. A write is only ever derived from a **successfully loaded** document — the
 *     defaults are a render fallback, never a save payload (a partial document
 *     PUT merges over the stored row, so defaults would reset real settings).
 *  2. The one-time local→server widget seed runs **once per workspace**, not once
 *     per page load: a completed migration is marked locally, so deleting every
 *     widget cannot be undone by a stale browser blob.
 */
export function useDashboardConfig() {
  const queryClient = useQueryClient();
  const prefsQuery = useDashboardPreferencesQuery();
  const widgetsQuery = useDashboardWidgetsQuery();
  const prefsMutation = useDashboardPreferencesMutation();
  const widgetsMutation = useDashboardWidgetsMutation();
  const widgetDeleteMutation = useDashboardWidgetDeleteMutation();
  const widgetsReorderMutation = useDashboardWidgetsReorderMutation();
  const { t } = useTranslation();
  const { can } = usePermissions();

  const canWriteDashboard =
    can(DASHBOARD_MODULE_MANIFEST.permissions.setupWrite) ||
    can(DASHBOARD_MODULE_MANIFEST.permissions.customize);

  const prefs: DashboardPreferences = prefsQuery.data ?? DEFAULT_DASHBOARD_PREFERENCES;
  const serverWidgets = widgetsQuery.hasServerData ? widgetsQuery.data : [];
  // First-paint placeholder only (read-only, never persisted): the server list is
  // authoritative as soon as the query succeeds — including a deliberate empty set.
  const placeholderWidgets = useMemo(() => peekSeedWidgets(), []);
  const customWidgets: CustomWidget[] = widgetsQuery.hasServerData
    ? serverWidgets
    : placeholderWidgets;

  const isConfigReady = prefsQuery.hasLoadedPreferences && widgetsQuery.hasServerData;

  // `onMutate` writes the optimistic document asynchronously (it awaits
  // `cancelQueries`), so two preference writes inside one tick would both build on
  // the same stale base and the second PUT would drop the first change. This ref
  // carries the newest document synchronously between calls.
  const latestPrefsRef = useRef<DashboardPreferences | null>(null);
  useEffect(() => {
    if (prefsQuery.hasLoadedPreferences) latestPrefsRef.current = prefs;
  }, [prefs, prefsQuery.hasLoadedPreferences]);

  useEffect(() => {
    if (!widgetsQuery.hasServerData) return;
    if (hasSeededDashboardWidgets()) return;

    // The workspace already has server widgets: the migration is done, so retire
    // the legacy blob instead of leaving it around to resurrect deleted widgets.
    if (serverWidgets.length > 0) {
      markDashboardWidgetsSeeded();
      clearLegacyDashboardWidgets();
      return;
    }

    if (!canWriteDashboard || dashboardSeedAttempts.has(queryClient)) return;
    // One attempt per app session — deliberately never removed on failure, so a
    // persistent error cannot turn into a retry loop (the old code re-armed on
    // every failed mutation).
    dashboardSeedAttempts.add(queryClient);
    const seed = peekSeedWidgets();
    if (seed.length === 0) return;

    void (async () => {
      try {
        const seeded = await seedDashboardWidgets(seed);
        if (!seeded) {
          reportClientError(new Error("Dashboard widget seed was rejected"), {
            context: "dashboard.seedWidgets",
          });
          return;
        }
        markDashboardWidgetsSeeded();
        clearLegacyDashboardWidgets();
        await queryClient.invalidateQueries({ queryKey: DASHBOARD_WIDGETS_QUERY_KEY });
      } catch (error) {
        // One attempt per session: a retry loop here would hammer the API on a
        // persistent failure (and a reload starts a fresh session attempt).
        reportClientError(error, { context: "dashboard.seedWidgets" });
      }
    })();
  }, [widgetsQuery.hasServerData, serverWidgets.length, canWriteDashboard, queryClient]);

  /** Full-array upsert (visualizer pin set + bulk flows). Upsert-only — never wipes absent rows. */
  const updateCustomWidgets = (customWidgetsDraft: CustomWidget[]) => {
    if (!canWriteDashboard || !widgetsQuery.hasServerData) return;
    widgetsMutation.mutate({ body: customWidgetsDraft });
  };

  /** Atomic widget reordering with optimistic cache update. */
  const reorderCustomWidgets = (order: Array<{ id: string; sortOrder: number }>) => {
    if (!canWriteDashboard) return;
    widgetsReorderMutation.mutate({ body: { order } });
  };

  const updatePref = useCallback(
    <K extends keyof DashboardPreferences>(key: K, value: DashboardPreferences[K]) => {
      if (!canWriteDashboard) return;
      if (!prefsQuery.hasLoadedPreferences) {
        // Never save the defaults: a full-document PUT would overwrite the stored
        // thresholds/chart settings with them.
        reportClientWarn(new Error("Dashboard preferences are still loading"), {
          context: "dashboard.updatePref",
        });
        return;
      }
      // Build on the newest document: the synchronous ref first (same-tick
      // writes), then the optimistic cache, then the rendered snapshot.
      const cached = queryClient.getQueryData(DASHBOARD_PREFERENCES_QUERY_KEY) as
        { body?: { preferences?: DashboardPreferences } } | undefined;
      const latest = latestPrefsRef.current ?? cached?.body?.preferences ?? prefs;
      const next = { ...latest, [key]: value };
      latestPrefsRef.current = next;
      prefsMutation.mutate({ body: next });
    },
    [canWriteDashboard, prefs, prefsMutation, prefsQuery.hasLoadedPreferences, queryClient],
  );

  const toggleCardVisibility = (cardId: string) => {
    const disabledCardIds = latestPrefsRef.current?.disabledCardIds ?? prefs.disabledCardIds;
    const s = new Set(disabledCardIds);
    if (s.has(cardId)) {
      s.delete(cardId);
    } else {
      s.add(cardId);
    }
    updatePref("disabledCardIds", [...s]);
  };

  /** Upsert only the affected widget (inserts new, updates existing; leaves others untouched). Resolves on success so builder flows can await before closing (§7). */
  const saveWidget = (savedWidget: CustomWidget) => {
    if (!canWriteDashboard) return Promise.resolve();
    return widgetsMutation.mutateAsync({ body: [savedWidget] });
  };

  const toggleWidgetPin = (widgetId: string) => {
    if (!canWriteDashboard || !widgetsQuery.hasServerData) return;
    const target = customWidgets.find((widget) => widget.id === widgetId);
    if (!target) return;
    widgetsMutation.mutate({
      body: [{ ...target, isPinnedToDashboard: !target.isPinnedToDashboard }],
    });
  };

  const unpinWidget = (widgetId: string) => {
    if (!canWriteDashboard || !widgetsQuery.hasServerData) return;
    const target = customWidgets.find((widget) => widget.id === widgetId);
    if (!target) return;
    widgetsMutation.mutate({ body: [{ ...target, isPinnedToDashboard: false }] });
  };

  /**
   * Hard delete via `DELETE /:id` (never bulk-wipe PUT). The row is gone after the
   * request, so the confirmation step is an undo toast that re-upserts the widget
   * (the backend upserts by id) — no dialog interrupts the edit flow.
   */
  const deleteWidget = (widgetId: string) => {
    if (!canWriteDashboard) return;
    const deletedWidget = customWidgets.find((widget) => widget.id === widgetId);
    widgetDeleteMutation.mutate(
      { params: { id: widgetId }, body: {} },
      deletedWidget
        ? {
            onSuccess: () => {
              notify.archivedWithUndo(
                t("dashboard.widgetDeleted"),
                () => saveWidget(deletedWidget),
                { undoLabel: t("common.undo") },
              );
            },
          }
        : undefined,
    );
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
    isConfigReady,
  };
}
