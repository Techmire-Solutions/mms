import { useTenant } from "@/lib/contexts/TenantContext";

/**
 * Blocks tenant auth UI until workspace branding has been fetched from the server.
 * Apex hosts and missing-tenant hosts skip the wait (platform theme owns those screens).
 */
export function useTenantBranding(): { ready: boolean } {
  const { isApex, workspaceLoading } = useTenant();

  if (isApex) {
    return { ready: true };
  }

  if (workspaceLoading) {
    return { ready: false };
  }

  // Missing or loaded tenant — AuthLayout applies public branding when present.
  return { ready: true };
}
