/** Platform (apex) white-label branding contracts, defaults, and update schema. */
import { z } from "zod";
import { DEFAULT_BRANDING_CORNER_STYLE, type BrandingCornerStyle } from "./brandingCornerStyle.js";
import {
  BRANDING_FOOTER_MAX,
  BRANDING_NAME_MAX,
  BRANDING_SOCIAL_PLATFORMS,
  BRANDING_TAGLINE_MAX,
  DEFAULT_BRANDING_SETTINGS,
  type BrandingSocialLink,
} from "./brandingSettingsTypes.js";

/** Console-title cap (short product subtitle, e.g. "Platform Console"). */
export const PLATFORM_BRANDING_CONSOLE_TITLE_MAX = 60;

/** Asset URL cap (uploaded relative path or absolute https URL). */
export const PLATFORM_BRANDING_ASSET_URL_MAX = 2048;

/**
 * Instance-level branding for the SaaS operator's own console and apex pages.
 * Mirrors {@link BrandingSettings} but names the product (`productName`) and adds
 * a `consoleTitle`, so a white-label install never implies a "madrasa".
 */
export interface PlatformBrandingSettings {
  /** Public product name shown in the console shell and apex auth pages. */
  productName: string;
  /** Subtitle shown next to the product name (defaults to "Platform Console"). */
  consoleTitle: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  cornerStyle: BrandingCornerStyle;
  logoUrl: string;
  faviconUrl: string;
  footerText: string;
  email: string;
  phone: string;
  website: string;
  legalName: string;
  registrationNumber: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  socialLinks: BrandingSocialLink[];
  updatedAt?: string;
}

/** Fields safe to expose on the unauthenticated apex entry routes. */
export type PublicPlatformBranding = Pick<
  PlatformBrandingSettings,
  | "productName"
  | "consoleTitle"
  | "tagline"
  | "logoUrl"
  | "faviconUrl"
  | "primaryColor"
  | "secondaryColor"
  | "cornerStyle"
  | "footerText"
>;

/** Identity fields (branding tab) — everything except theme colours/footer. */
export const PLATFORM_BRANDING_IDENTITY_FIELD_KEYS = [
  "productName",
  "consoleTitle",
  "tagline",
  "logoUrl",
  "faviconUrl",
  "email",
  "phone",
  "website",
  "legalName",
  "registrationNumber",
  "addressLine1",
  "addressLine2",
  "city",
  "region",
  "postalCode",
  "country",
  "socialLinks",
] as const satisfies readonly (keyof PlatformBrandingSettings)[];

/** Appearance fields (theme tab). */
export const PLATFORM_BRANDING_THEME_FIELD_KEYS = [
  "primaryColor",
  "secondaryColor",
  "cornerStyle",
  "footerText",
] as const satisfies readonly (keyof PlatformBrandingSettings)[];

/** Authoritative platform branding defaults — MMS gold/brown, no assumption of a name. */
export const DEFAULT_PLATFORM_BRANDING: PlatformBrandingSettings = {
  productName: "",
  consoleTitle: "",
  tagline: "",
  primaryColor: DEFAULT_BRANDING_SETTINGS.primaryColor,
  secondaryColor: DEFAULT_BRANDING_SETTINGS.secondaryColor,
  cornerStyle: DEFAULT_BRANDING_CORNER_STYLE,
  logoUrl: "",
  faviconUrl: "",
  footerText: "",
  email: "",
  phone: "",
  website: "",
  legalName: "",
  registrationNumber: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "",
  socialLinks: [],
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Relative upload path or absolute http(s) URL — blocks `javascript:`/`data:` assets. */
function isAllowedAssetUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith("/")) return !trimmed.startsWith("//");
  return /^https?:\/\//i.test(trimmed);
}

/** Strict partial update body for `PUT /api/platform/branding`. */
export const platformBrandingUpdateSchema = z
  .object({
    productName: z.string().max(BRANDING_NAME_MAX).optional(),
    consoleTitle: z.string().max(PLATFORM_BRANDING_CONSOLE_TITLE_MAX).optional(),
    tagline: z.string().max(BRANDING_TAGLINE_MAX).optional(),
    primaryColor: z.string().regex(HEX_COLOR, "Expected a #RRGGBB colour").optional(),
    secondaryColor: z.string().regex(HEX_COLOR, "Expected a #RRGGBB colour").optional(),
    cornerStyle: z.string().max(32).optional(),
    logoUrl: z
      .string()
      .max(PLATFORM_BRANDING_ASSET_URL_MAX)
      .refine(isAllowedAssetUrl, "Invalid asset URL")
      .optional(),
    faviconUrl: z
      .string()
      .max(PLATFORM_BRANDING_ASSET_URL_MAX)
      .refine(isAllowedAssetUrl, "Invalid asset URL")
      .optional(),
    footerText: z.string().max(BRANDING_FOOTER_MAX).optional(),
    email: z.string().max(255).or(z.literal("")).optional(),
    phone: z.string().max(40).optional(),
    website: z.string().max(255).optional(),
    legalName: z.string().max(BRANDING_NAME_MAX).optional(),
    registrationNumber: z.string().max(80).optional(),
    addressLine1: z.string().max(200).optional(),
    addressLine2: z.string().max(200).optional(),
    city: z.string().max(100).optional(),
    region: z.string().max(100).optional(),
    postalCode: z.string().max(40).optional(),
    country: z.string().max(100).optional(),
    socialLinks: z
      .array(
        z
          .object({
            platform: z
              .string()
              .max(40)
              .refine(
                (value) => (BRANDING_SOCIAL_PLATFORMS as readonly string[]).includes(value),
                "Unsupported social platform",
              ),
            url: z.string().max(500),
          })
          .strict(),
      )
      .max(8)
      .optional(),
  })
  .strict();

export type PlatformBrandingUpdateInput = z.infer<typeof platformBrandingUpdateSchema>;
