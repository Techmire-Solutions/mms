import { useQuery } from "@tanstack/react-query";
import { resolveAppDomainForRequest } from "@mms/shared";
import { env } from "@/lib/config/env";
import { apiFetch, resolveApiUrl } from "@/lib/apiClient";

export const DEPLOYMENT_CONFIG_KEY = ["public", "deployment-config"] as const;

/**
 * Server-authoritative apex domain — applies the same self-correction as the backend
 * when MMS_APP_DOMAIN / VITE_APP_DOMAIN is shorter than the platform hostname.
 */
export function useDeploymentAppDomain(): string {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const fallback = resolveAppDomainForRequest(hostname, env.appDomain);

  const { data: deploymentConfig } = useQuery<{ appDomain: string }>({
    queryKey: DEPLOYMENT_CONFIG_KEY,
    queryFn: async ({ signal }): Promise<{ appDomain: string }> => {
      const url = resolveApiUrl("/api/public/deployment-config");
      const res = await apiFetch(url, { signal });
      if (!res.ok) {
        return { appDomain: fallback };
      }
      return (await res.json()) as { appDomain: string };
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  return deploymentConfig?.appDomain ?? fallback;
}
