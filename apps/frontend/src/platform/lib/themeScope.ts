import {
  DEFAULT_BRANDING_SETTINGS,
  DEFAULT_GLOBAL_SETTINGS,
  mergeBrandingSettings,
  mergeGlobalSettings,
  type BrandingSettings,
  type GlobalSettings,
  isApexHost,
} from "@mms/shared";
import { getAppDomain } from "@/lib/config/tenantConfig";

/**
 * Hardcoded MMS platform theme for the apex domain (marketing, console, onboarding).
 * Never reads tenant localStorage or customised institution branding.
 * Platform UI is English-only (LTR).
 */
export const MMS_PLATFORM_BRANDING: BrandingSettings = mergeBrandingSettings({
  ...DEFAULT_BRANDING_SETTINGS,
  primaryColor: "#d99b00",
  secondaryColor: "#5c3412",
  logoUrl: "/platform-logo.webp",
});

/** Default global settings on apex (light theme, English). */
export const MMS_PLATFORM_GLOBAL_SETTINGS: GlobalSettings =
  mergeGlobalSettings(DEFAULT_GLOBAL_SETTINGS);

/** True when the hostname is a tenant workspace (`{subdomain}.localhost` or `{subdomain}.{platform-domain}`). */
export function isTenantHost(): boolean {
  if (typeof window === "undefined") return false;
  return !isApexHost(window.location.hostname, getAppDomain());
}

/**
 * Platform apex is always English/LTR. Same lock applies on tenant hosts for
 * platform status screens (missing, disabled, or non-404 lookup failure).
 *
 * While a tenant workspace is still loading, do not force English so enabled
 * RTL tenants keep their stored language on first paint. Once lookup settles,
 * only a confirmed enabled workspace keeps the tenant locale.
 */
export function shouldForcePlatformEnglish(options: {
  isApex: boolean;
  workspaceLoading: boolean;
  workspace: { enabled?: boolean } | null;
  /** Non-404 workspace lookup failure — stay on tenant host with platform theme. */
  workspaceLookupFailed?: boolean;
}): boolean {
  if (options.isApex) return true;
  if (options.workspaceLookupFailed) return true;
  if (options.workspace?.enabled === true) return false;
  if (options.workspaceLoading) return false;
  return true;
}
