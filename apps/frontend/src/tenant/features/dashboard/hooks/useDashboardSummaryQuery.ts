/**
 * @file useDashboardSummaryQuery.ts
 * @description Server-side dashboard metric summary (one aggregate request per role/day).
 *
 * Kept in its own module so `useDashboardData` can import it directly instead of
 * reaching through `collections/dashboard`, which re-exports `useDashboardData`
 * and would otherwise close an ESM import cycle.
 */

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { fetchDashboardSummaryAsync } from "./dashboardApi";

export const DASHBOARD_SUMMARY_QUERY_KEY_ROOT = ["dashboard", "summary"] as const;
export const DASHBOARD_SUMMARY_QUERY_KEY = (date?: string, role?: string) =>
  [...DASHBOARD_SUMMARY_QUERY_KEY_ROOT, { date, role }] as const;

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
