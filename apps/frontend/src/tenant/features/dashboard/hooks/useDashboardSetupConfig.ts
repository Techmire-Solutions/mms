import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import { DEFAULT_DASHBOARD_PREFERENCES, normalizeDashboardPreferences } from "@mms/shared";
import { buildDefaultCustomWidgets } from "@/lib/reports/widgetDefaults";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";
import { tsrClient } from "@/lib/api";
import { fetchDashboardSummaryAsync } from "./dashboardApi";

export const DASHBOARD_PREFERENCES_QUERY_KEY = ["dashboard", "preferences"] as const;
export const DASHBOARD_WIDGETS_QUERY_KEY = ["dashboard", "widgets"] as const;
export const DASHBOARD_SUMMARY_QUERY_KEY = (date?: string, role?: string) =>
  ["dashboard", "summary", { date, role }] as const;

/** Pure seeded default widgets, computed once — placeholder while the server query loads. */
const DEFAULT_WIDGETS_PLACEHOLDER: CustomWidget[] = buildDefaultCustomWidgets();

export function invalidateDashboardQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: DASHBOARD_PREFERENCES_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: DASHBOARD_WIDGETS_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
}

export function useDashboardSummaryQuery(
  date?: string,
  role?: string,
  options?: { enabled?: boolean; refetchInterval?: number },
) {
  const { isAuthenticated } = useAuth();
  const query = useQuery({
    queryKey: DASHBOARD_SUMMARY_QUERY_KEY(date, role),
    queryFn: ({ signal }) => fetchDashboardSummaryAsync(date, role, signal),
    enabled: isAuthenticated && (options?.enabled ?? true),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: options?.refetchInterval ?? 60_000,
    placeholderData: keepPreviousData,
  });

  return {
    ...query,
    summary: query.data,
  };
}

export function useDashboardPreferencesQuery() {
  const { isAuthenticated } = useAuth();
  const query = tsrClient.dashboard.getPreferences.useQuery({
    queryKey: DASHBOARD_PREFERENCES_QUERY_KEY,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const preferences = query.data?.body?.preferences
    ? normalizeDashboardPreferences(query.data.body.preferences)
    : DEFAULT_DASHBOARD_PREFERENCES;

  return { ...query, data: preferences };
}

export function useDashboardPreferencesMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return tsrClient.dashboard.putPreferences.useMutation({
    onSuccess: (res: { status: number; body?: { preferences?: unknown } }) => {
      if (res.status === 200 && res.body?.preferences) {
        queryClient.setQueryData(DASHBOARD_PREFERENCES_QUERY_KEY, res);
        invalidateDashboardQueries(queryClient);
      }
    },
    onError: () => notify.error(t("dashboard.toast.prefSaveFailed")),
  });
}

export function useDashboardWidgetsQuery() {
  const { isAuthenticated } = useAuth();
  const query = tsrClient.dashboard.getWidgets.useQuery({
    queryKey: DASHBOARD_WIDGETS_QUERY_KEY,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const widgets = query.data?.body?.widgets
    ? (query.data.body.widgets as CustomWidget[])
    : DEFAULT_WIDGETS_PLACEHOLDER;

  return { ...query, data: widgets };
}

export function useDashboardWidgetsMutation() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return tsrClient.dashboard.putWidgets.useMutation({
    onSuccess: (res: { status: number; body?: { widgets?: unknown } }) => {
      if (res.status === 200 && res.body?.widgets) {
        queryClient.setQueryData(DASHBOARD_WIDGETS_QUERY_KEY, res);
        invalidateDashboardQueries(queryClient);
      }
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
              widgets: cached.body.widgets.filter((widget) => widget.id !== widgetId),
            },
          };
        });
      }
      invalidateDashboardQueries(queryClient);
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
        const orderMap = new Map(body.order.map((item) => [item.id, item.sortOrder]));
        const updated = [...previousWidgets]
          .map((widget) => {
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
