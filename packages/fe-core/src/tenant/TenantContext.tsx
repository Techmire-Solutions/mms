import React, { createContext, useContext, useEffect } from "react";
import {
  parseTenantFromHost,
  isApexHost,
  buildTenantUrl,
  buildApexUrl,
} from "@mms/contracts/tenantUtils";
import type { PublicBranding } from "@mms/contracts";
import { getTenantUrlOptions } from "../config/tenantConfig";
import { useDeploymentAppDomain } from "./useDeploymentAppDomain";
import {
  cacheWorkspaceLookup,
  isWorkspaceNotFoundError,
  useWorkspaceBySubdomain,
  type PublicWorkspace,
  type WorkspaceLookupResult,
} from "./useWorkspaceBySubdomain";
import { queryClientInstance } from "../query/queryClient";
import { configureApiClient } from "../api/client";

export type { PublicWorkspace };

export interface TenantProviderProps {
  children: React.ReactNode;
  /** Optional cache hook supplied by the app (offline branding snapshot). */
  cacheBranding?: (branding: PublicBranding) => void;
}

export interface TenantContextValue {
  appDomain: string;
  subdomain: string | null;
  isApex: boolean;
  workspace: PublicWorkspace | null;
  publicBranding: PublicBranding | null;
  workspaceLoading: boolean;
  /** True when the subdomain host has no registered workspace (404 / empty). */
  workspaceMissing: boolean;
  /** True when workspace lookup failed for a non-404 reason (network / 5xx). */
  workspaceLookupFailed: boolean;
  workspaceUrl: string | null;
  refetchWorkspace: () => void;
  redirectToApex: (path?: string) => void;
  redirectToTenant: (subdomain: string, path?: string) => void;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

export const TenantProvider: React.FC<TenantProviderProps> = ({ children, cacheBranding }) => {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "localhost";
  const appDomain = useDeploymentAppDomain();
  const subdomain = (() =>
    typeof window !== "undefined" ? parseTenantFromHost(hostname, appDomain) : null)();
  const isApex = (() => (typeof window !== "undefined" ? isApexHost(hostname, appDomain) : true))();

  useEffect(() => {
    configureApiClient({ getTenantId: () => subdomain });
  }, [subdomain]);

  const tenantLookupEnabled = !isApex && Boolean(subdomain);
  const {
    data: workspaceLookup,
    error: workspaceError,
    isPending,
    isError,
    isFetched,
    refetch,
  } = useWorkspaceBySubdomain(subdomain, tenantLookupEnabled);
  const workspaceLoading = tenantLookupEnabled && isPending && !isFetched;
  const lookupBody = workspaceLookup?.body as
    { workspace?: PublicWorkspace; branding?: PublicBranding | null } | undefined;
  const workspace = lookupBody?.workspace ?? null;
  const notFound = isWorkspaceNotFoundError(workspaceError) || workspaceLookup?.status === 404;
  const workspaceMissing =
    tenantLookupEnabled &&
    !workspaceLoading &&
    (notFound || (isFetched && !isError && workspace === null));
  const workspaceLookupFailed = tenantLookupEnabled && !workspaceLoading && isError && !notFound;
  // Missing tenants hard-redirect to apex Tenant Not Found — skip branding fetch.
  const publicBranding = lookupBody?.branding ?? null;

  const prevSubdomainRef = React.useRef<string | null | undefined>(undefined);
  React.useEffect(() => {
    if (prevSubdomainRef.current !== undefined && prevSubdomainRef.current !== subdomain) {
      queryClientInstance.clear();
    }
    prevSubdomainRef.current = subdomain;
  }, [subdomain]);

  React.useEffect(() => {
    if (subdomain && lookupBody?.workspace) {
      cacheWorkspaceLookup(subdomain, lookupBody as WorkspaceLookupResult);
      if (lookupBody.branding) {
        cacheBranding?.(lookupBody.branding);
      }
    }
  }, [subdomain, lookupBody, cacheBranding]);

  const workspaceUrl = subdomain ? buildTenantUrl(subdomain, "/", getTenantUrlOptions()) : null;

  const refetchWorkspace = React.useCallback(() => {
    void refetch();
  }, [refetch]);

  const redirectToApex = React.useCallback((path = "/") => {
    window.location.href = buildApexUrl(path, getTenantUrlOptions());
  }, []);

  const redirectToTenant = React.useCallback((targetSubdomain: string, path = "/") => {
    window.location.href = buildTenantUrl(targetSubdomain, path, getTenantUrlOptions());
  }, []);

  // Stable value identity — this context is consumed by TranslationProvider, so an
  // unstable object here cascades a re-render through every `useTranslation` consumer.
  const value = React.useMemo<TenantContextValue>(
    () => ({
      appDomain,
      subdomain,
      isApex,
      workspace,
      publicBranding,
      workspaceLoading,
      workspaceMissing,
      workspaceLookupFailed,
      workspaceUrl,
      refetchWorkspace,
      redirectToApex,
      redirectToTenant,
    }),
    [
      appDomain,
      subdomain,
      isApex,
      workspace,
      publicBranding,
      workspaceLoading,
      workspaceMissing,
      workspaceLookupFailed,
      workspaceUrl,
      refetchWorkspace,
      redirectToApex,
      redirectToTenant,
    ],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export function useTenant(): TenantContextValue {
  const tenantContext = useContext(TenantContext);
  if (!tenantContext) {
    throw new Error("useTenant must be used within TenantProvider");
  }
  return tenantContext;
}

export function useOptionalTenant(): TenantContextValue | undefined {
  return useContext(TenantContext);
}
