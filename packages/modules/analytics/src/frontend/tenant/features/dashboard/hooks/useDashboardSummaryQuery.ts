/**
 * @file useDashboardSummaryQuery.ts
 * @description Server-side dashboard metric summary (one aggregate request per workspace/day).
 *
 * Kept in its own module so `useDashboardData` can import it directly instead of
 * reaching through `collections/dashboard`, which re-exports `useDashboardData`
 * and would otherwise close an ESM import cycle.
 */

import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";
import { useAuth } from "@mms/fe-core/auth/AuthContext";
import type { DashboardRole } from "../../../lib/dashboardRole";
import { fetchDashboardSummaryAsync } from "./dashboardApi";

import { DASHBOARD_SUMMARY_QUERY_KEY_ROOT } from "@mms/fe-core/query/dashboardQueryKeys";
export { DASHBOARD_SUMMARY_QUERY_KEY_ROOT };
/**
 * The server filters sections by the caller's authoritative permissions, so the
 * dashboard role is a presentation hint only — it is sent with the request but
 * deliberately kept out of the cache key (otherwise the view-role resolving at
 * boot would fetch the same summary twice).
 */
export const DASHBOARD_SUMMARY_QUERY_KEY = (date?: string) =>
  [...DASHBOARD_SUMMARY_QUERY_KEY_ROOT, { date }] as const;

export interface DashboardSummaryQueryOptions {
  date?: string;
  role?: DashboardRole;
  /** Caller gate (e.g. an explicit `enabled: false`). Defaults to true. */
  enabled?: boolean;
  /** Staleness bound when the realtime socket is unavailable. */
  refetchInterval?: number;
  /** Session gate; unauthenticated queries never execute. */
  authenticated?: boolean;
}

/** Colocated queryOptions factory — reusable in `useQuery`/`prefetchQuery` call sites. */
export function dashboardSummaryQueryOptions(options: DashboardSummaryQueryOptions = {}) {
  const { date, role, enabled = true, refetchInterval = 60_000, authenticated = true } = options;
  return queryOptions({
    queryKey: DASHBOARD_SUMMARY_QUERY_KEY(date),
    queryFn: ({ signal }) => fetchDashboardSummaryAsync(date, role, signal),
    enabled: authenticated && enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    // Realtime events also invalidate this root; the interval only bounds
    // staleness when the socket is unavailable (workspace-local attendance).
    refetchInterval,
    placeholderData: keepPreviousData,
  });
}

export function useDashboardSummaryQuery(
  date?: string,
  role?: DashboardRole,
  options?: { enabled?: boolean; refetchInterval?: number },
) {
  const { isAuthenticated } = useAuth();
  const query = useQuery(
    dashboardSummaryQueryOptions({
      date,
      role,
      enabled: options?.enabled ?? true,
      refetchInterval: options?.refetchInterval,
      authenticated: isAuthenticated,
    }),
  );

  return {
    ...query,
    summary: query.data,
  };
}
