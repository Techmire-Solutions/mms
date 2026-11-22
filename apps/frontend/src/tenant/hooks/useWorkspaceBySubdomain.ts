import { useQuery } from "@tanstack/react-query";
import { apiContract } from "@/lib/api";
import type { PublicBranding } from "@mms/shared";

export interface PublicWorkspace {
  subdomain: string;
  madrasaName: string;
  tagline?: string;
  enabled?: boolean;
  industryType?: string;
}

export interface WorkspaceLookupResult {
  workspace: PublicWorkspace;
  branding: PublicBranding | null;
}

export const WORKSPACE_BY_SUBDOMAIN_KEY = ["workspace", "by-subdomain"] as const;

/** True when the workspace-by-subdomain API confirms the tenant does not exist. */
export function isWorkspaceNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "status" in error && error.status === 404;
}

const WORKSPACE_CACHE_PREFIX = "mms_ws_lookup_";

/** Public workspace lookup cached under `mms_ws_lookup_{subdomain}` (public branding data only). */
export function getCachedWorkspaceLookup(
  subdomain: string | null,
): { status: 200; body: WorkspaceLookupResult } | undefined {
  if (!subdomain || typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(`${WORKSPACE_CACHE_PREFIX}${subdomain.toLowerCase()}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as WorkspaceLookupResult;
    if (parsed?.workspace?.subdomain) {
      return { status: 200, body: parsed };
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Stores a public workspace lookup for fast subsequent boots on the same browser. */
export function cacheWorkspaceLookup(subdomain: string, data: WorkspaceLookupResult): void {
  if (!subdomain || typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${WORKSPACE_CACHE_PREFIX}${subdomain.toLowerCase()}`,
      JSON.stringify(data),
    );
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Public workspace lookup by subdomain. A 404 resolves to `{ status: 404,
 * body: null }` (missing tenant); other failures reject with a status-bearing
 * error so the query retry policy can distinguish them.
 */
export async function fetchWorkspaceBySubdomain(
  subdomain: string,
  signal?: AbortSignal,
): Promise<{ status: number; body: WorkspaceLookupResult | null }> {
  const response = await apiContract.workspace.bySubdomain({
    params: { subdomain },
    signal,
    fetchOptions: { signal },
  });
  if (response.status === 404) {
    return { status: 404, body: null };
  }
  if (response.status !== 200) {
    const error = Object.assign(new Error(`Workspace lookup failed: ${response.status}`), {
      status: response.status,
    });
    throw error;
  }
  return { status: 200, body: response.body as WorkspaceLookupResult };
}

/**
 * Public workspace + branding for a subdomain, seeded from the local lookup
 * cache and refreshed from the server (the seed is marked stale so a mount
 * always revalidates). 404s are data, not errors, and never retried.
 */
export function useWorkspaceBySubdomain(subdomain: string | null, enabled: boolean) {
  return useQuery<{ status: number; body: WorkspaceLookupResult | null }>({
    queryKey: [...WORKSPACE_BY_SUBDOMAIN_KEY, subdomain],
    queryFn: ({ signal }) => fetchWorkspaceBySubdomain(subdomain!, signal),
    enabled: enabled && Boolean(subdomain),
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    // Function form: the localStorage seed is only read when the query first
    // mounts for this subdomain, not on every render.
    initialData: () => (enabled && subdomain ? getCachedWorkspaceLookup(subdomain) : undefined),
    initialDataUpdatedAt: 0,
    retry: (failureCount: number, error: unknown) =>
      !isWorkspaceNotFoundError(error) && failureCount < 3,
  });
}
