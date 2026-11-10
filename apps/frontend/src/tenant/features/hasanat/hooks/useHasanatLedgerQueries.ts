/**
 * Hasanat ledger (redemptions) hooks — the paginated history behind the Redemptions tab.
 *
 * Split from `useHasanatQueries` so the module keeps one concern per file and stays under the
 * 300-line ceiling. `useHasanatQueries` re-exports these for the public barrel.
 */

import type { Redemption } from "@mms/shared";
import { useAuth } from "@/lib/contexts/AuthContext";
import { usePermissions } from "@/tenant/hooks/usePermissions";
import { tsrClient } from "@/lib/api";
import { HASANAT_REDEMPTIONS_QUERY_KEY } from "./hasanatQueryKeys";

/** Maximum ledger page the tracker requests (server cap is 200). */
export const LEDGER_TRACKER_PAGE_SIZE = 200;

export function useHasanatRedemptions(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const { can } = usePermissions();
  const canRead = can("hasanat.read");
  return tsrClient.hasanat.listRedemptions.useQuery({
    queryKey: [...HASANAT_REDEMPTIONS_QUERY_KEY, { limit: LEDGER_TRACKER_PAGE_SIZE }],
    // The ledger endpoint is paginated; the tracker renders one bounded page (max 200) and the
    // drawer links to the full history per card.
    queryData: { query: { limit: LEDGER_TRACKER_PAGE_SIZE } },
    enabled: isAuthenticated && canRead && (options?.enabled ?? true),
    staleTime: 30_000,
  });
}

/**
 * Ledger query state for the Redemption tab: the collection hook collapses loading/failure to an
 * empty array, which rendered "0 redemptions" before the first response and after an error.
 */
export function useHasanatRedemptionsState(options?: { enabled?: boolean }): {
  redemptions: Redemption[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
} {
  const query = useHasanatRedemptions(options);
  const body: unknown = query.data?.status === 200 ? query.data.body : null;
  const redemptions = Array.isArray(body)
    ? (body as Redemption[])
    : ((body as { redemptions?: Redemption[] } | null)?.redemptions ?? []);
  return {
    redemptions,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: () => {
      void query.refetch();
    },
  };
}

export function useHasanatRedemptionsCollection(options?: { enabled?: boolean }): Redemption[] {
  const query = useHasanatRedemptions(options);
  if (!query.data || query.data.status !== 200) return [];
  const body: unknown = query.data.body;
  if (Array.isArray(body)) return body as Redemption[];
  return (body as { redemptions?: Redemption[] } | null)?.redemptions ?? [];
}
