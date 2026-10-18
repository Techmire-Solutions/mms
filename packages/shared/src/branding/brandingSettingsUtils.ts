/** Branding settings merge, dirty-check, and format helpers. */
import { translateAppParams } from "../i18n/appTranslations.js";
import { normalizeBrandingCornerStyle } from "./brandingCornerStyle.js";
import { normalizeToE164, parsePhoneNumber } from "../core/phoneUtils.js";
import {
  BRANDING_FOOTER_MAX,
  BRANDING_NAME_MAX,
  BRANDING_SOCIAL_PLATFORMS,
  BRANDING_TAGLINE_MAX,
  DEFAULT_BRANDING_SETTINGS,
  type BrandingSettings,
  type BrandingSocialLink,
  type OnboardingBrandingInput,
  type PublicBranding,
} from "./brandingSettingsTypes.js";

const BRANDING_HEX = /^#[0-9a-f]{6}$/i;

function normalizeBrandingHexLocal(raw: string | undefined, fallback: string): string {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return fallback.toLowerCase();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  if (!BRANDING_HEX.test(withHash)) return fallback.toLowerCase();
  return withHash.toLowerCase();
}

/** Default copyright footer for auth screens and documents (locale-aware). */
export function formatBrandingFooterDefault(madrasaName: string, language: string): string {
  const name = madrasaName.trim() || DEFAULT_BRANDING_SETTINGS.madrasaName;
  const year = String(new Date().getFullYear());
  return translateAppParams("theme.footerDefault", language, { year, name });
}

/** Builds a complete `branding` object from onboarding (sign-in page + settings tab). */
export function buildBrandingFromOnboarding(input: OnboardingBrandingInput): BrandingSettings {
  const name = input.madrasaName.trim() || DEFAULT_BRANDING_SETTINGS.madrasaName;
  const logo = input.logoUrl?.trim() ?? "";

  return mergeBrandingSettings({
    madrasaName: name,
    tagline: input.tagline?.trim() || DEFAULT_BRANDING_SETTINGS.tagline,
    primaryColor: input.primaryColor || DEFAULT_BRANDING_SETTINGS.primaryColor,
    secondaryColor: input.secondaryColor || DEFAULT_BRANDING_SETTINGS.secondaryColor,
    logoUrl: logo,
    faviconUrl: input.faviconUrl?.trim() || logo,
    footerText: input.footerText?.trim() || DEFAULT_BRANDING_SETTINGS.footerText,
    legalName: input.legalName?.trim() || name,
    registrationNumber: input.registrationNumber?.trim() ?? "",
    addressLine1: input.addressLine1?.trim() ?? "",
    addressLine2: input.addressLine2?.trim() ?? "",
    city: input.city?.trim() ?? "",
    region: input.region?.trim() ?? "",
    postalCode: input.postalCode?.trim() ?? "",
    country: input.country?.trim() ?? "",
    email: input.adminEmail?.trim() ?? "",
    phone: input.adminPhone?.trim() ?? "",
    website: input.website?.trim() ?? "",
    socialLinks: input.socialLinks ?? [],
  });
}

type LegacyBranding = Partial<BrandingSettings> & { address?: string };

/** Extracts login-safe branding fields from a merged settings record. */
export function toPublicBranding(settings: BrandingSettings): PublicBranding {
  return {
    madrasaName: settings.madrasaName,
    tagline: settings.tagline,
    logoUrl: settings.logoUrl,
    faviconUrl: settings.faviconUrl,
    primaryColor: settings.primaryColor,
    secondaryColor: settings.secondaryColor,
  };
}

/** Picks a subset of branding fields for scoped dirty checks and preview patches. */
export function pickBrandingFields<K extends keyof BrandingSettings>(
  settings: BrandingSettings,
  keys: readonly K[],
): Pick<BrandingSettings, K> {
  const result = {} as Pick<BrandingSettings, K>;
  for (const key of keys) {
    result[key] = settings[key];
  }
  return result;
}

/** Returns whether any field in `keys` differs between draft and persisted baseline. */
export function isBrandingFieldsDirty(
  data: BrandingSettings,
  baseline: BrandingSettings,
  keys: readonly (keyof BrandingSettings)[],
): boolean {
  return (
    JSON.stringify(pickBrandingFields(data, keys)) !==
    JSON.stringify(pickBrandingFields(baseline, keys))
  );
}

function trimField(value: string | undefined, maxLen?: number): string {
  const trimmed = (value ?? "").trim();
  if (maxLen !== undefined && trimmed.length > maxLen) {
    return trimmed.slice(0, maxLen);
  }
  return trimmed;
}

function normalizeBrandingPhone(phone: string | undefined): string {
  const trimmed = trimField(phone);
  if (!trimmed) return "";
  const parsed = parsePhoneNumber(trimmed);
  return normalizeToE164(parsed.countryCode, parsed.number);
}

function normalizeSocialLinks(links: BrandingSocialLink[] | undefined): BrandingSocialLink[] {
  if (!Array.isArray(links)) return [];
  const allowed = new Set<string>(BRANDING_SOCIAL_PLATFORMS);
  return links
    .map((link) => ({
      platform: allowed.has(link.platform) ? link.platform : BRANDING_SOCIAL_PLATFORMS[0],
      url: (link.url ?? "").trim(),
    }))
    .filter((link) => link.url.length > 0);
}

export function mergeBrandingSettings(
  partial: LegacyBranding | null | undefined,
): BrandingSettings {
  const merged: BrandingSettings = {
    ...DEFAULT_BRANDING_SETTINGS,
    ...(partial ?? {}),
    madrasaName:
      partial && "madrasaName" in partial
        ? trimField(partial.madrasaName, BRANDING_NAME_MAX)
        : DEFAULT_BRANDING_SETTINGS.madrasaName,
    tagline:
      partial && "tagline" in partial
        ? trimField(partial.tagline, BRANDING_TAGLINE_MAX)
        : DEFAULT_BRANDING_SETTINGS.tagline,
    email: trimField(partial?.email),
    phone: normalizeBrandingPhone(partial?.phone),
    website: trimField(partial?.website),
    legalName: trimField(partial?.legalName),
    registrationNumber: trimField(partial?.registrationNumber),
    addressLine1: trimField(partial?.addressLine1),
    addressLine2: trimField(partial?.addressLine2),
    city: trimField(partial?.city),
    region: trimField(partial?.region),
    postalCode: trimField(partial?.postalCode),
    country: trimField(partial?.country),
    logoUrl: trimField(partial?.logoUrl ?? DEFAULT_BRANDING_SETTINGS.logoUrl),
    faviconUrl: trimField(partial?.faviconUrl ?? DEFAULT_BRANDING_SETTINGS.faviconUrl),
    footerText:
      partial && "footerText" in partial
        ? trimField(partial.footerText, BRANDING_FOOTER_MAX)
        : DEFAULT_BRANDING_SETTINGS.footerText,
    primaryColor: normalizeBrandingHexLocal(
      partial?.primaryColor,
      DEFAULT_BRANDING_SETTINGS.primaryColor,
    ),
    secondaryColor: normalizeBrandingHexLocal(
      partial?.secondaryColor,
      DEFAULT_BRANDING_SETTINGS.secondaryColor,
    ),
    cornerStyle: normalizeBrandingCornerStyle(partial?.cornerStyle),
    socialLinks: normalizeSocialLinks(partial?.socialLinks),
  };

  if (partial?.address && !partial.addressLine1) {
    merged.addressLine1 = trimField(partial.address);
  }

  return merged;
}

/**
 * Formats structured address fields into a single line for invoices and print views.
 */
export function formatBrandingAddress(
  branding: Pick<
    BrandingSettings,
    "addressLine1" | "addressLine2" | "city" | "region" | "postalCode" | "country"
  >,
): string {
  const locality = [branding.city, branding.region].filter(Boolean).join(", ");
  return [
    branding.addressLine1,
    branding.addressLine2,
    locality,
    branding.postalCode,
    branding.country,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * Validates whether the minimum required institution details (identity, contact, address)
 * have been filled by the administrator. Used to enforce first-login setup gating.
 */
export function isInstitutionSetupComplete(
  branding: Partial<BrandingSettings> | null | undefined,
): boolean {
  if (!branding) return false;
  const name = branding.madrasaName?.trim();
  const tagline = branding.tagline?.trim();
  const email = branding.email?.trim();
  const phone = branding.phone?.trim();
  const addressLine1 = branding.addressLine1?.trim();
  const city = branding.city?.trim();
  const country = branding.country?.trim();
  const postalCode = branding.postalCode?.trim();

  return Boolean(
    name && tagline && email && phone && addressLine1 && city && country && postalCode,
  );
}
