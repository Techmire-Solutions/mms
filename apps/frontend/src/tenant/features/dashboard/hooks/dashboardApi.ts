import { apiContract } from "@/lib/api";
import { ApiError } from "@/lib/apiClient";

/**
 * Dashboard composite summary fetch.
 *
 * The configuration documents (preferences/widgets) are read and written through
 * the typed ts-rest React Query hooks in `useDashboardSetupConfig`; this module
 * intentionally holds only the plain-fetch summary reader.
 */
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
