import type { User } from "@mms/shared";
import { MutationCache, QueryCache, QueryClient, onlineManager } from "@tanstack/react-query";
import { isApiError } from "@/lib/apiClient";
import { createIdbCachePersister } from "@/lib/query/idbCachePersister";
import { refreshModuleAccessOnDenial } from "@/lib/query/moduleAccessQuery";
import { createQueryPersistenceLifecycle } from "@/lib/query/queryPersistenceLifecycle";

import {
  readQueryCacheSession,
  resolveQueryCacheSession,
  revokeQueryCacheSession,
  tenantCacheIdentity,
} from "@/lib/query/queryCacheSession";

class SessionQueryClient extends QueryClient {
  private persistence?: ReturnType<typeof createQueryPersistenceLifecycle>;
  private cacheKey = readQueryCacheSession()?.key;
  private identity?: string;
  private revision = 0;

  get sessionRevision(): number {
    return this.revision;
  }

  override clear(): void {
    this.revision += 1;
    revokeQueryCacheSession(this.cacheKey);
    this.persistence?.stop();
    this.persistence = undefined;
    this.identity = undefined;
    this.cacheKey = undefined;
    super.clear();
  }

  activateTenantSession(user: User): Promise<void> {
    const identity = tenantCacheIdentity(user);
    if (user.mustChangePassword) {
      this.clear();
      return Promise.resolve();
    }
    if (
      this.identity === identity &&
      this.cacheKey === readQueryCacheSession()?.key &&
      this.persistence
    ) {
      return this.persistence.start();
    }
    if (this.identity) this.clear();
    else super.clear();
    this.identity = identity;
    const session = resolveQueryCacheSession(identity);
    this.cacheKey = session?.key;
    if (!session) return Promise.resolve();
    this.persistence = createQueryPersistenceLifecycle(
      this,
      createIdbCachePersister({ key: session.key }),
      () => readQueryCacheSession()?.key === session.key,
    );
    return this.persistence.start();
  }
}

/** Standard tiered stale times for TanStack Query caching across MMS domains. */
export const TRANSACTIONAL_STALE_TIME = 30_000; // 30s: directory lists, recent logs, live queues
export const SUMMARY_STALE_TIME = 60_000; // 60s: dashboard KPIs, aggregate report strips
export const SETUP_STALE_TIME = 5 * 60_000; // 5m: module settings, custom fields, fee structures
export const STATIC_LOOKUP_STALE_TIME = 30 * 60_000; // 30m: branding, static enums, reference tables

/**
 * Shared React Query client — server state defaults for tenant REST resources.
 * Features 3-attempt exponential backoff, 24h gcTime for offline readiness, and online-mode pausing.
 */
export const queryClientInstance = new SessionQueryClient({
  // A module-gate 403 anywhere means access changed mid-session: refetch the snapshot.
  queryCache: new QueryCache({
    onError: (error) => refreshModuleAccessOnDenial(queryClientInstance, error),
  }),
  mutationCache: new MutationCache({
    onError: (error) => refreshModuleAccessOnDenial(queryClientInstance, error),
  }),
  defaultOptions: {
    queries: {
      staleTime: TRANSACTIONAL_STALE_TIME,
      gcTime: 24 * 60 * 60_000, // 24 hours to support offline restoration
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      networkMode: "online",
      retry: (failureCount, error) => {
        if (
          isApiError(error) &&
          (error.status === 401 || error.status === 403 || error.status === 404)
        ) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
    },
    mutations: {
      networkMode: "online",
      retry: false,
    },
  },
});

// Automatically resume paused mutations upon network recovery
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    onlineManager.setOnline(true);
    void queryClientInstance.resumePausedMutations();
  });
  window.addEventListener("offline", () => {
    onlineManager.setOnline(false);
  });

  // Legacy unscoped records are never restored.
  void createIdbCachePersister().removeClient();
}
