import { parseTenantFromHost, resolveAppDomainForRequest } from "@mms/contracts";
import { requestHostname } from "./requestHost.js";

/**
 * Request tenant context.
 *
 * The AsyncLocalStorage storage and every getter/binder live in `@mms/db`
 * (`request-context`), so the data layer can enforce tenant scoping without
 * importing the backend. This module keeps only the HTTP-specific host parsing,
 * which is a transport concern.
 */
export * from "@mms/db/request-context";

/** Extracts tenant subdomain from Host / X-Forwarded-Host (Vite dev proxy). */
export function resolveSubdomainFromRequest(
  hostHeader: string | undefined,
  forwardedHost?: string | string[] | undefined,
): string | null {
  const hostname = requestHostname({
    hostname: hostHeader ?? "",
    headers: {
      host: hostHeader,
      "x-forwarded-host": forwardedHost,
    },
  });
  const appDomain = resolveAppDomainForRequest(hostname, process.env.MMS_APP_DOMAIN);
  return parseTenantFromHost(hostname, appDomain);
}
