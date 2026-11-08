/**
 * @file useDashboardSummaryQuery.ts
 * @description Server-side dashboard metric summary (one aggregate request per workspace/day).
 *
 * Kept in its own module so `useDashboardData` can import it directly instead of
 * reaching through `collections/dashboard`, which re-exports `useDashboardData`
 * and would otherwise close an ESM import cycle.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import type { DashboardRole } from "@/lib/dashboardRole";
import { fetchDashboardSummaryAsync } from "./dashboardApi";

import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "@/lib/query/dashboardQueryKeys";
export { DASHBOARD_SUMMARY_QUERY_KEY_ROOT };
/**
 * The server filters sections by the caller's authoritative permissions, so the
 * dashboard role is a presentation hint only — it is sent with the request but
 * deliberately kept out of the cache key (otherwise the view-role resolving at
 * boot would fetch the same summary twice).
 */
export const DASHBOARD_SUMMARY_QUERY_KEY = (date?: string) =>
  [...DASHBOARD_SUMMARY_QUERY_KEY_ROOT, { date }] as const;

export function useDashboardSummaryQuery(
  date?: string,
  role?: DashboardRole,
  options?: { enabled?: boolean; refetchInterval?: number },
) {
  const { isAuthenticated } = useAuth();
  const query = useQuery({
    queryKey: DASHBOARD_SUMMARY_QUERY_KEY(date),
    queryFn: ({ signal }) => fetchDashboardSummaryAsync(date, role, signal),
    enabled: isAuthenticated && (options?.enabled ?? true),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    // Realtime events also invalidate this root; the interval only bounds
    // staleness when the socket is unavailable (workspace-local attendance).
    refetchInterval: options?.refetchInterval ?? 60_000,
    placeholderData: keepPreviousData,
  });

  return {
    ...query,
    summary: query.data,
  };
}
