/** Branding settings contracts, presets, and field key registries. */
import type { AppTranslationKey } from "../i18n/appTranslations.js";
import { DEFAULT_BRANDING_CORNER_STYLE, type BrandingCornerStyle } from "./brandingCornerStyle.js";

/** A single social profile link on the institution branding record. */
export interface BrandingSocialLink {
  platform: string;
  url: string;
}

export const BRANDING_NAME_MAX = 60;
export const BRANDING_FOOTER_MAX = 120;

/** Singleton object stored under the `branding` key. */
export interface BrandingSettings {
  madrasaName: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  /** UI corner roundness — injected as CSS `--radius` on tenant hosts. */
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
}

/** Branding fields safe to expose on public auth/workspace routes. */
export type PublicBranding = Pick<
  BrandingSettings,
  "madrasaName" | "tagline" | "logoUrl" | "faviconUrl" | "primaryColor" | "secondaryColor"
>;

/** Preset social platforms for branding profile links. */
export const BRANDING_SOCIAL_PLATFORMS = [
  "Facebook",
  "Instagram",
  "X (Twitter)",
  "LinkedIn",
  "YouTube",
  "TikTok",
  "WhatsApp",
  "Telegram",
] as const;

export type BrandingSocialPlatformId = (typeof BRANDING_SOCIAL_PLATFORMS)[number];

/** Registry entries for social platform pickers (stable id + translation key). */
export const BRANDING_SOCIAL_PLATFORM_DEFS: readonly {
  id: BrandingSocialPlatformId;
  labelKey: AppTranslationKey;
}[] = [
  { id: "Facebook", labelKey: "branding.socialPlatformFacebook" },
  { id: "Instagram", labelKey: "branding.socialPlatformInstagram" },
  { id: "X (Twitter)", labelKey: "branding.socialPlatformX" },
  { id: "LinkedIn", labelKey: "branding.socialPlatformLinkedIn" },
  { id: "YouTube", labelKey: "branding.socialPlatformYouTube" },
  { id: "TikTok", labelKey: "branding.socialPlatformTikTok" },
  { id: "WhatsApp", labelKey: "branding.socialPlatformWhatsApp" },
  { id: "Telegram", labelKey: "branding.socialPlatformTelegram" },
] as const;

export const BRANDING_SOCIAL_PLACEHOLDERS: Record<string, string> = {
  Facebook: "https://facebook.com/your-page",
  Instagram: "https://instagram.com/your-page",
  "X (Twitter)": "https://x.com/your-page",
  LinkedIn: "https://linkedin.com/company/your-page",
  YouTube: "https://youtube.com/@your-channel",
  TikTok: "https://tiktok.com/@your-page",
  WhatsApp: "+44 7700 900000",
  Telegram: "https://t.me/your-page",
};

/** Curated brand colour palettes (primary + accent) for theme settings and onboarding. */
export const BRANDING_THEME_PRESETS = [
  {
    id: "emerald",
    labelKey: "theme.presetEmerald",
    primaryColor: "#036348",
    secondaryColor: "#9e340a",
    category: "green",
  },
  {
    id: "teal",
    labelKey: "theme.presetTeal",
    primaryColor: "#0d635c",
    secondaryColor: "#8d4107",
    category: "green",
  },
  {
    id: "blue",
    labelKey: "theme.presetBlue",
    primaryColor: "#1c4cce",
    secondaryColor: "#8d4107",
    category: "blue",
  },
  {
    id: "indigo",
    labelKey: "theme.presetIndigo",
    primaryColor: "#4338ca",
    secondaryColor: "#9e340a",
    category: "blue",
  },
  {
    id: "purple",
    labelKey: "theme.presetPurple",
    primaryColor: "#7b21ca",
    secondaryColor: "#8d4107",
    category: "blue",
  },
  {
    id: "rose",
    labelKey: "theme.presetRose",
    primaryColor: "#ad1037",
    secondaryColor: "#334155",
    category: "warm",
  },
  {
    id: "amber",
    labelKey: "theme.presetAmber",
    primaryColor: "#8d4107",
    secondaryColor: "#036348",
    category: "warm",
  },
  {
    id: "slate",
    labelKey: "theme.presetSlate",
    primaryColor: "#334155",
    secondaryColor: "#9e340a",
    category: "neutral",
  },
] as const;

export const BRANDING_TAGLINE_MAX = 80;

/** Inputs collected during madrasa onboarding that map to the branding record. */
export interface OnboardingBrandingInput {
  madrasaName: string;
  tagline?: string;
  subdomain: string;
  country?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  adminEmail?: string;
  adminPhone?: string;
  website?: string;
  footerText?: string;
  faviconUrl?: string;
  legalName?: string;
  registrationNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  socialLinks?: BrandingSocialLink[];
}

/** Hardcoded MMS platform theme (apex domain). Tenant workspaces customise via the `branding` object. */
export const DEFAULT_BRANDING_SETTINGS: BrandingSettings = {
  madrasaName: "MMS",
  tagline: "Nurturing Knowledge & Character",
  primaryColor: "#d99b00",
  secondaryColor: "#5c3412",
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

/** Institution identity fields — name, contact, assets, address, social (not theme colours). */
export type BrandingIdentityFields = Pick<
  BrandingSettings,
  | "madrasaName"
  | "tagline"
  | "logoUrl"
  | "faviconUrl"
  | "email"
  | "phone"
  | "website"
  | "legalName"
  | "registrationNumber"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "region"
  | "postalCode"
  | "country"
  | "socialLinks"
>;

/** Theme / appearance fields stored on the same branding record. */
export type BrandingThemeFields = Pick<
  BrandingSettings,
  "primaryColor" | "secondaryColor" | "cornerStyle" | "footerText"
>;

/** Keys tracked for dirty/preview on Settings → Institution. */
export const BRANDING_IDENTITY_FIELD_KEYS = [
  "madrasaName",
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
] as const satisfies readonly (keyof BrandingIdentityFields)[];

/** Keys tracked for dirty/preview on Settings → Theme. */
export const BRANDING_THEME_FIELD_KEYS = [
  "primaryColor",
  "secondaryColor",
  "cornerStyle",
  "footerText",
] as const satisfies readonly (keyof BrandingThemeFields)[];
