import {
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_PLATFORM_BRANDING,
  mergeGlobalSettings,
  platformBrandingToBrandingSettings,
  type BrandingSettings,
  type GlobalSettings,
} from "@mms/shared";

/**
 * Fallback platform branding used before the runtime white-label store hydrates
 * (and by Server-rendered tests). Runtime code reads
 * `@/lib/branding/platformBrandingStore` instead.
 */
export const MMS_PLATFORM_BRANDING: BrandingSettings = platformBrandingToBrandingSettings({
  ...DEFAULT_PLATFORM_BRANDING,
  productName: "MMS",
  logoUrl: "/platform-logo.webp",
});

/** Default global settings on apex (light theme, English). */
export const MMS_PLATFORM_GLOBAL_SETTINGS: GlobalSettings =
  mergeGlobalSettings(DEFAULT_GLOBAL_SETTINGS);

export { isTenantHost } from "@/lib/config/tenantConfig";

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
