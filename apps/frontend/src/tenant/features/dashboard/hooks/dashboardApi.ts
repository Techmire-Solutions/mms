import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";
import {
  normalizeDashboardWidgets,
  type DashboardPreferences,
  type DashboardPreferencesPutBody,
  type DashboardWidgetDto,
  type DashboardWidgetsPutBody,
} from "@mms/shared";

export async function fetchDashboardPreferences(
  signal?: AbortSignal,
): Promise<DashboardPreferences | null> {
  const res = await apiContract.dashboard.getPreferences({
    query: {},
  });
  if (res.status === 200) {
    return (res.body as { preferences?: DashboardPreferences }).preferences ?? null;
  }
  return null;
}

export async function saveDashboardPreferencesAsync(
  prefs: DashboardPreferencesPutBody,
  signal?: AbortSignal,
): Promise<DashboardPreferences> {
  const res = await apiContract.dashboard.putPreferences({
    body: prefs,
  });
  if (res.status === 200) {
    return (res.body as { preferences: DashboardPreferences }).preferences;
  }
  throw new Error("Failed to save dashboard preferences");
}

export async function fetchDashboardWidgets(signal?: AbortSignal): Promise<DashboardWidgetDto[]> {
  const res = await apiContract.dashboard.getWidgets({ query: {} });
  if (res.status === 200) {
    return (res.body as { widgets?: DashboardWidgetDto[] }).widgets ?? [];
  }
  return [];
}

export async function saveDashboardWidgetsAsync(
  widgets: DashboardWidgetsPutBody,
  signal?: AbortSignal,
): Promise<DashboardWidgetDto[]> {
  const sanitizedWidgets = normalizeDashboardWidgets(widgets);
  const res = await apiContract.dashboard.putWidgets({
    body: sanitizedWidgets,
  });
  if (res.status === 200) {
    return (res.body as { widgets: DashboardWidgetDto[] }).widgets;
  }
  throw new Error("Failed to save dashboard widgets");
}

export async function deleteDashboardWidgetAsync(id: string, signal?: AbortSignal): Promise<void> {
  await apiContract.dashboard.deleteWidget({
    params: { id },
    body: {},
  });
}

export async function reorderDashboardWidgetsAsync(
  order: Array<{ id: string; sortOrder: number }>,
  signal?: AbortSignal,
): Promise<void> {
  const res = await apiContract.dashboard.reorderWidgets({
    body: { order },
  });
  if (res.status !== 200) {
    throw new Error("Failed to reorder dashboard widgets");
  }
}

export async function fetchDashboardSummaryAsync(
  date?: string,
  role?: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const res = await apiContract.dashboard.getSummary({
    query: { date, role },
    fetchOptions: { signal },
  });
  if (res.status === 200) {
    return (res.body as { summary: Record<string, unknown> }).summary;
  }
  const errorBody = res.body as { message?: string; type?: string } | undefined;
  throw new ApiError(
    res.status,
    errorBody?.message ?? `Dashboard summary request failed (${res.status})`,
    errorBody?.type,
  );
}
