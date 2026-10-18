import { useQuery } from "@tanstack/react-query";
import { resolveApiUrl } from "@/lib/apiClient";
import { PLATFORM_QUERY_KEYS } from "@/platform/lib/platformQueryKeys";

export type PlatformHealthStatus = "operational" | "degraded" | "unknown";

async function fetchPlatformHealth(signal: AbortSignal): Promise<PlatformHealthStatus> {
  try {
    const url = resolveApiUrl("/health");
    const res = await fetch(url, { signal, credentials: "include" });
    if (!res.ok) return "degraded";
    const data = (await res.json()) as { status?: string };
    return data.status === "OK" ? "operational" : "degraded";
  } catch {
    return "unknown";
  }
}

/** Polls /health every 60 s to drive the operational status badge in the header. */
export function usePlatformHealth(): { status: PlatformHealthStatus; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: PLATFORM_QUERY_KEYS.health,
    queryFn: ({ signal }) => fetchPlatformHealth(signal),
    refetchInterval: 60_000,
    retry: 1,
    staleTime: 30_000,
  });

  return { status: data ?? "unknown", isLoading };
}
