import { useQuery } from "@tanstack/react-query";
import { resolveAppDomainForRequest } from "@mms/shared";
import { env } from "@/lib/config/env";
import { apiContract } from "@/lib/api";

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
      const response = await apiContract.public.deploymentConfig({
        signal,
        fetchOptions: { signal },
      });
      if (response.status !== 200) {
        return { appDomain: fallback };
      }
      return { appDomain: (response.body as { appDomain: string }).appDomain };
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });

  return deploymentConfig?.appDomain ?? fallback;
}
