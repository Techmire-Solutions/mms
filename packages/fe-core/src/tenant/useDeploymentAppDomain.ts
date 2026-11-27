import { useQuery } from "@tanstack/react-query";
import { resolveAppDomainForRequest } from "@mms/contracts";
import { env } from "../config/env";
import { apiFetch, resolveApiUrl } from "../api/client";

export const DEPLOYMENT_CONFIG_KEY = ["public", "deployment-config"] as const;

/**
 * Server-authoritative apex domain — applies the same self-correction as the backend
 * when MMS_APP_DOMAIN / VITE_APP_DOMAIN is shorter than the platform hostname.
 * Uses `apiFetch` directly so the public entry closure avoids pulling the 24-domain
 * `rootContract` (`@mms/fe-core/api/tsRest`) into unauthenticated initial loads.
 */
export function useDeploymentAppDomain(): string {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const fallback = resolveAppDomainForRequest(hostname, env.appDomain);

  const { data: deploymentConfig } = useQuery<{ appDomain: string }>({
    queryKey: DEPLOYMENT_CONFIG_KEY,
    queryFn: async ({ signal }): Promise<{ appDomain: string }> => {
      const response = await apiFetch(resolveApiUrl("/api/public/deployment-config"), {
        method: "GET",
        signal,
      });
      if (response.status !== 200) {
        return { appDomain: fallback };
      }
      const body = (await response.json().catch(() => null)) as { appDomain?: string } | null;
      return { appDomain: body?.appDomain ?? fallback };
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  return deploymentConfig?.appDomain ?? fallback;
}
