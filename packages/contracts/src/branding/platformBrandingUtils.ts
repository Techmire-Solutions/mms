/** Platform branding merge/normalization, public projection, and console adapter. */
import {
  BRANDING_FOOTER_MAX,
  BRANDING_NAME_MAX,
  type BrandingSettings,
  type BrandingSocialLink,
} from "./brandingSettingsTypes.js";
import { formatBrandingFooterDefault, mergeBrandingSettings } from "./brandingSettingsUtils.js";
import {
  DEFAULT_PLATFORM_BRANDING,
  PLATFORM_BRANDING_CONSOLE_TITLE_MAX,
  type PlatformBrandingSettings,
  type PublicPlatformBranding,
} from "./platformBrandingTypes.js";

function trim(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function normalizeSocialLinks(value: unknown): BrandingSocialLink[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is BrandingSocialLink =>
        Boolean(entry) &&
        typeof entry === "object" &&
        typeof (entry as BrandingSocialLink).platform === "string" &&
        typeof (entry as BrandingSocialLink).url === "string",
    )
    .map((entry) => ({ platform: entry.platform.trim(), url: entry.url.trim() }))
    .filter((entry) => entry.url.length > 0)
    .slice(0, 8);
}

/** Deep-merges a platform branding patch with defaults (normalising colours, phone, corners). */
export function mergePlatformBranding(
  partial?: Partial<PlatformBrandingSettings> | null,
): PlatformBrandingSettings {
  const merged = mergeBrandingSettings(
    partial
      ? {
          madrasaName: partial.productName === undefined ? undefined : partial.productName,
          tagline: partial.tagline,
          primaryColor: partial.primaryColor,
          secondaryColor: partial.secondaryColor,
          cornerStyle: partial.cornerStyle,
          logoUrl: partial.logoUrl,
          faviconUrl: partial.faviconUrl,
          footerText: partial.footerText,
          email: partial.email,
          phone: partial.phone,
          website: partial.website,
          legalName: partial.legalName,
          registrationNumber: partial.registrationNumber,
          addressLine1: partial.addressLine1,
          addressLine2: partial.addressLine2,
          city: partial.city,
          region: partial.region,
          postalCode: partial.postalCode,
          country: partial.country,
          socialLinks: partial.socialLinks,
        }
      : null,
  );

  const productName =
    partial?.productName === undefined
      ? DEFAULT_PLATFORM_BRANDING.productName
      : trim(partial.productName, BRANDING_NAME_MAX);
  const consoleTitle =
    partial?.consoleTitle === undefined
      ? DEFAULT_PLATFORM_BRANDING.consoleTitle
      : trim(partial.consoleTitle, PLATFORM_BRANDING_CONSOLE_TITLE_MAX);

  return {
    productName,
    consoleTitle,
    tagline: merged.tagline,
    primaryColor: merged.primaryColor,
    secondaryColor: merged.secondaryColor,
    cornerStyle: merged.cornerStyle,
    logoUrl: merged.logoUrl,
    faviconUrl: merged.faviconUrl,
    footerText: trim(merged.footerText, BRANDING_FOOTER_MAX),
    email: merged.email,
    phone: merged.phone,
    website: merged.website,
    legalName: merged.legalName,
    registrationNumber: merged.registrationNumber,
    addressLine1: merged.addressLine1,
    addressLine2: merged.addressLine2,
    city: merged.city,
    region: merged.region,
    postalCode: merged.postalCode,
    country: merged.country,
    socialLinks: normalizeSocialLinks(merged.socialLinks),
    ...(partial?.updatedAt === undefined ? {} : { updatedAt: partial.updatedAt }),
  };
}

/** Public (unauthenticated) projection — identity/contact fields are deliberately excluded. */
export function toPublicPlatformBranding(
  branding: PlatformBrandingSettings,
): PublicPlatformBranding {
  return {
    productName: branding.productName,
    consoleTitle: branding.consoleTitle,
    tagline: branding.tagline,
    logoUrl: branding.logoUrl,
    faviconUrl: branding.faviconUrl,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    cornerStyle: branding.cornerStyle,
    footerText: branding.footerText,
  };
}

/**
 * Adapts platform branding to the tenant `BrandingSettings` shape used by the
 * shared theme/favicon pipeline. `productName` becomes `madrasaName` (the field
 * the theme calculator and document-favicon fallback read).
 */
export function platformBrandingToBrandingSettings(
  branding: PlatformBrandingSettings,
): BrandingSettings {
  return mergeBrandingSettings({
    madrasaName: branding.productName,
    tagline: branding.tagline,
    primaryColor: branding.primaryColor,
    secondaryColor: branding.secondaryColor,
    cornerStyle: branding.cornerStyle,
    logoUrl: branding.logoUrl,
    faviconUrl: branding.faviconUrl,
    footerText: branding.footerText,
    email: branding.email,
    phone: branding.phone,
    website: branding.website,
    legalName: branding.legalName,
    registrationNumber: branding.registrationNumber,
    addressLine1: branding.addressLine1,
    addressLine2: branding.addressLine2,
    city: branding.city,
    region: branding.region,
    postalCode: branding.postalCode,
    country: branding.country,
    socialLinks: branding.socialLinks,
  });
}

/** Picks the requested branding fields from a full record. */
export function pickPlatformBrandingFields<K extends keyof PlatformBrandingSettings>(
  branding: PlatformBrandingSettings,
  keys: readonly K[],
): Pick<PlatformBrandingSettings, K> {
  const picked = {} as Pick<PlatformBrandingSettings, K>;
  for (const key of keys) picked[key] = branding[key];
  return picked;
}

/** True when any of the tracked fields differs between draft and baseline. */
export function isPlatformBrandingFieldsDirty(
  draft: PlatformBrandingSettings,
  baseline: PlatformBrandingSettings,
  keys: readonly (keyof PlatformBrandingSettings)[],
): boolean {
  return keys.some((key) => draft[key] !== baseline[key]);
}

/** Overlays only the tracked draft fields onto a fresh server baseline. */
export function mergePlatformBrandingOverBaseline(
  baseline: PlatformBrandingSettings,
  patch: Partial<PlatformBrandingSettings>,
  keys: readonly (keyof PlatformBrandingSettings)[],
): PlatformBrandingSettings {
  const next: PlatformBrandingSettings = { ...baseline };
  for (const key of keys) {
    if (patch[key] !== undefined) {
      (next as unknown as Record<string, unknown>)[key] = patch[key];
    }
  }
  return next;
}

/** Locale-aware default footer for the platform product name. */
export function formatPlatformFooterDefault(productName: string, language = "en"): string {
  return formatBrandingFooterDefault(productName || "MMS", language);
}

/** Fallback product name shown when an install has not set a platform brand name. */
export const PLATFORM_BRANDING_NAME_FALLBACK = "Madrasa MS";
