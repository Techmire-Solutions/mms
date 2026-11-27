import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import { useTranslation } from "@mms/fe-core/i18n";
import { notify } from "@mms/fe-core/notify";
import {
  DEFAULT_DASHBOARD_PREFERENCES,
  normalizeDashboardPreferences,
  normalizeDashboardWidgets,
} from "@mms/contracts";
import { buildDefaultCustomWidgets } from "@mms/mod-analytics/frontend/tenant/lib/widgetDefaults";
import type { CustomWidget } from "@mms/mod-analytics/frontend/tenant/lib/pinnedWidgetTypes";
import { apiContract, tsrClient } from "@mms/fe-core/api/tsRest";

export {
  DASHBOARD_SUMMARY_QUERY_KEY,
  DASHBOARD_SUMMARY_QUERY_KEY_ROOT,
  useDashboardSummaryQuery,
} from "./useDashboardSummaryQuery";

export const DASHBOARD_PREFERENCES_QUERY_KEY = ["dashboard", "preferences"] as const;
export const DASHBOARD_WIDGETS_QUERY_KEY = ["dashboard", "widgets"] as const;

/** Pure seeded default widgets, computed once — placeholder while the server query loads. */
const DEFAULT_WIDGETS_PLACEHOLDER: CustomWidget[] = buildDefaultCustomWidgets();

/**
 * Invalidates only the dashboard *configuration* documents. The composite
 * summary is a domain-metrics aggregate: it does not read the layout, so a
 * grid-density toggle or a pin must not refetch the 10-way aggregation.
 * Domain collection changes invalidate the summary through
 * `invalidateModuleQueries`.
 *
 * Individual mutations invalidate precisely (only the document they wrote);
 * this helper remains for cross-feature callers that touch the whole config.
 */
export function invalidateDashboardConfigQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: DASHBOARD_PREFERENCES_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: DASHBOARD_WIDGETS_QUERY_KEY });
}

/**
 * One-time local→server widget seed for a brand-new workspace.
 *
 * Uses the plain contract client (not the mutation hook) so a failed background
 * seed never surfaces a "save failed" toast for a write the user did not make.
 */
export async function seedDashboardWidgets(widgets: CustomWidget[]): Promise<boolean> {
  const res = await apiContract.dashboard.putWidgets({
    body: normalizeDashboardWidgets(widgets),
  });
  return res.status === 200;
}

export function useDashboardPreferencesQuery() {
  const { isAuthenticated } = useAuth();
  const query = tsrClient.dashboard.getPreferences.useQuery({
    queryKey: DASHBOARD_PREFERENCES_QUERY_KEY,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const rawPreferences = query.data?.body?.preferences;
  const preferences = useMemo(
    () =>
      rawPreferences
        ? normalizeDashboardPreferences(rawPreferences)
        : DEFAULT_DASHBOARD_PREFERENCES,
    [rawPreferences],
  );

  // `isSuccess` alone is not enough: a 200 body without a preferences document
  // must not be treated as a loaded configuration.
  const hasLoadedPreferences = query.isSuccess && rawPreferences !== undefined;
  const updatedAt = query.data?.body?.updatedAt ?? null;
  return { ...query, data: preferences, updatedAt, hasLoadedPreferences };
}

export function useDashboardPreferencesMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return tsrClient.dashboard.putPreferences.useMutation({
    // Optimistic: two toggles inside one round-trip must not lose the first
    // write (the prefs document is a full singleton). The body is merged over
    // the last known document so a partial caller can never reset omitted fields.
    onMutate: async (variables: { body: unknown }) => {
      await queryClient.cancelQueries({ queryKey: DASHBOARD_PREFERENCES_QUERY_KEY });
      const previous = queryClient.getQueryData(DASHBOARD_PREFERENCES_QUERY_KEY);
      const previousDoc = (
        previous as
          | { body?: { preferences?: Record<string, unknown>; updatedAt?: string | null } }
          | undefined
      )?.body;
      const merged = normalizeDashboardPreferences({
        ...(previousDoc?.preferences ?? {}),
        ...(variables.body as Record<string, unknown>),
      });
      queryClient.setQueryData(DASHBOARD_PREFERENCES_QUERY_KEY, {
        status: 200,
        body: { success: true, preferences: merged, updatedAt: previousDoc?.updatedAt ?? null },
      });
      return { previous };
    },
    onError: (
      _error: unknown,
      _variables: unknown,
      context: { previous?: unknown } | undefined,
    ) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(DASHBOARD_PREFERENCES_QUERY_KEY, context.previous);
      }
      // Re-sync the authoritative document (a 409 means another writer moved it).
      void queryClient.invalidateQueries({ queryKey: DASHBOARD_PREFERENCES_QUERY_KEY });
      notify.error(t("dashboard.toast.prefSaveFailed"));
    },
    onSuccess: (res: { status: number; body?: { preferences?: unknown } }) => {
      if (res.status === 200 && res.body?.preferences) {
        queryClient.setQueryData(DASHBOARD_PREFERENCES_QUERY_KEY, res);
      }
      // Precise invalidation: a preferences write never changes the widgets
      // document, so only the prefs key refetches.
      queryClient.invalidateQueries({ queryKey: DASHBOARD_PREFERENCES_QUERY_KEY });
    },
  });
}

export function useDashboardWidgetsQuery() {
  const { isAuthenticated } = useAuth();
  const query = tsrClient.dashboard.getWidgets.useQuery({
    queryKey: DASHBOARD_WIDGETS_QUERY_KEY,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const rawWidgets = query.data?.body?.widgets;
  const widgets = useMemo(
    () => (rawWidgets ? (rawWidgets as CustomWidget[]) : DEFAULT_WIDGETS_PLACEHOLDER),
    [rawWidgets],
  );

  // Distinguishes "server says empty" (authoritative) from "no server body yet"
  // (loading placeholder) — the seed decision depends on it.
  const hasServerData = rawWidgets !== undefined;
  return { ...query, data: widgets, hasServerData };
}

export function useDashboardWidgetsMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return tsrClient.dashboard.putWidgets.useMutation({
    onSuccess: (res: { status: number; body?: { widgets?: unknown } }) => {
      if (res.status === 200 && res.body?.widgets) {
        queryClient.setQueryData(DASHBOARD_WIDGETS_QUERY_KEY, res);
      }
      // Precise invalidation: a widgets write never changes the preferences
      // document, so only the widgets key refetches.
      queryClient.invalidateQueries({ queryKey: DASHBOARD_WIDGETS_QUERY_KEY });
    },
    onError: () => notify.error(t("dashboard.toast.saveFailed")),
  });
}

export function useDashboardWidgetDeleteMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return tsrClient.dashboard.deleteWidget.useMutation({
    onSuccess: (_data: unknown, variables: unknown) => {
      const widgetId =
        typeof variables === "string"
          ? variables
          : (variables as { params?: { id?: string } })?.params?.id;
      if (widgetId) {
        queryClient.setQueryData(DASHBOARD_WIDGETS_QUERY_KEY, (old: unknown) => {
          const cached = old as { body?: { widgets?: CustomWidget[] } } | undefined;
          if (!cached?.body?.widgets) return old;
          return {
            ...cached,
            body: {
              ...cached.body,
              widgets: cached.body.widgets.filter((widget: any) => widget.id !== widgetId),
            },
          };
        });
      }
      // Precise invalidation: a widget delete never changes the preferences
      // document, so only the widgets key refetches.
      queryClient.invalidateQueries({ queryKey: DASHBOARD_WIDGETS_QUERY_KEY });
    },
    onError: () => notify.error(t("dashboard.toast.deleteFailed")),
  });
}

export function useDashboardWidgetsReorderMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return tsrClient.dashboard.reorderWidgets.useMutation({
    onMutate: async ({ body }: { body: { order: Array<{ id: string; sortOrder: number }> } }) => {
      await queryClient.cancelQueries({ queryKey: DASHBOARD_WIDGETS_QUERY_KEY });
      const previousResponse = queryClient.getQueryData<{
        body?: { widgets?: CustomWidget[] };
      }>(DASHBOARD_WIDGETS_QUERY_KEY);
      const previousWidgets = previousResponse?.body?.widgets;

      if (previousWidgets) {
        const orderMap = new Map(body.order.map((item: any) => [item.id, item.sortOrder]));
        const updated = [...previousWidgets]
          .map((widget: any) => {
            const sortOrder = orderMap.get(widget.id);
            return sortOrder !== undefined ? { ...widget, sortOrder } : widget;
          })
          .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

        queryClient.setQueryData(DASHBOARD_WIDGETS_QUERY_KEY, {
          ...previousResponse,
          body: { ...previousResponse?.body, widgets: updated },
        });
      }

      return { previousResponse };
    },
    onError: (
      _err: unknown,
      _newOrder: unknown,
      context: { previousResponse?: { body?: { widgets?: CustomWidget[] } } } | undefined,
    ) => {
      if (context?.previousResponse) {
        queryClient.setQueryData(DASHBOARD_WIDGETS_QUERY_KEY, context.previousResponse);
      }
      notify.error(t("dashboard.toast.saveFailed"));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: DASHBOARD_WIDGETS_QUERY_KEY });
    },
  });
}
