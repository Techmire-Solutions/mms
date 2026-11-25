import { eq } from "drizzle-orm";
import {
  DEFAULT_PLATFORM_BRANDING,
  mergePlatformBranding,
  type PlatformBrandingSettings,
} from "@mms/contracts";
import { activeDb } from "@mms/db/client";
import { platformBranding } from "@mms/db/schema";

export const GLOBAL_BRANDING_ID = "global";

const platformBrandingColumns = {
  id: platformBranding.id,
  productName: platformBranding.productName,
  consoleTitle: platformBranding.consoleTitle,
  tagline: platformBranding.tagline,
  primaryColor: platformBranding.primaryColor,
  secondaryColor: platformBranding.secondaryColor,
  cornerStyle: platformBranding.cornerStyle,
  logoUrl: platformBranding.logoUrl,
  faviconUrl: platformBranding.faviconUrl,
  footerText: platformBranding.footerText,
  email: platformBranding.email,
  phone: platformBranding.phone,
  website: platformBranding.website,
  legalName: platformBranding.legalName,
  registrationNumber: platformBranding.registrationNumber,
  addressLine1: platformBranding.addressLine1,
  addressLine2: platformBranding.addressLine2,
  city: platformBranding.city,
  region: platformBranding.region,
  postalCode: platformBranding.postalCode,
  country: platformBranding.country,
  socialLinks: platformBranding.socialLinks,
  updatedAt: platformBranding.updatedAt,
};

type PlatformBrandingRowShape = {
  id: string;
  productName: string;
  consoleTitle: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  cornerStyle: string;
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
  socialLinks: PlatformBrandingSettings["socialLinks"];
  updatedAt: Date;
};

function rowToPlatformBranding(row: PlatformBrandingRowShape): PlatformBrandingSettings {
  return mergePlatformBranding({
    productName: row.productName,
    consoleTitle: row.consoleTitle,
    tagline: row.tagline,
    primaryColor: row.primaryColor,
    secondaryColor: row.secondaryColor,
    cornerStyle: row.cornerStyle,
    logoUrl: row.logoUrl,
    faviconUrl: row.faviconUrl,
    footerText: row.footerText,
    email: row.email,
    phone: row.phone,
    website: row.website,
    legalName: row.legalName,
    registrationNumber: row.registrationNumber,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    city: row.city,
    region: row.region,
    postalCode: row.postalCode,
    country: row.country,
    socialLinks: row.socialLinks,
    updatedAt: row.updatedAt.toISOString(),
  });
}

export async function findPlatformBrandingRow(
  id = GLOBAL_BRANDING_ID,
): Promise<PlatformBrandingSettings | null> {
  const rows = await activeDb()
    .select(platformBrandingColumns)
    .from(platformBranding)
    .where(eq(platformBranding.id, id))
    .limit(1);
  return rows[0] ? rowToPlatformBranding(rows[0]) : null;
}

export async function insertPlatformBrandingDefaultRow(): Promise<PlatformBrandingSettings | null> {
  const inserted = await activeDb()
    .insert(platformBranding)
    .values({
      id: GLOBAL_BRANDING_ID,
      productName: DEFAULT_PLATFORM_BRANDING.productName,
      consoleTitle: DEFAULT_PLATFORM_BRANDING.consoleTitle,
      tagline: DEFAULT_PLATFORM_BRANDING.tagline,
      primaryColor: DEFAULT_PLATFORM_BRANDING.primaryColor,
      secondaryColor: DEFAULT_PLATFORM_BRANDING.secondaryColor,
      cornerStyle: DEFAULT_PLATFORM_BRANDING.cornerStyle,
      logoUrl: DEFAULT_PLATFORM_BRANDING.logoUrl,
      faviconUrl: DEFAULT_PLATFORM_BRANDING.faviconUrl,
      footerText: DEFAULT_PLATFORM_BRANDING.footerText,
      email: DEFAULT_PLATFORM_BRANDING.email,
      phone: DEFAULT_PLATFORM_BRANDING.phone,
      website: DEFAULT_PLATFORM_BRANDING.website,
      legalName: DEFAULT_PLATFORM_BRANDING.legalName,
      registrationNumber: DEFAULT_PLATFORM_BRANDING.registrationNumber,
      addressLine1: DEFAULT_PLATFORM_BRANDING.addressLine1,
      addressLine2: DEFAULT_PLATFORM_BRANDING.addressLine2,
      city: DEFAULT_PLATFORM_BRANDING.city,
      region: DEFAULT_PLATFORM_BRANDING.region,
      postalCode: DEFAULT_PLATFORM_BRANDING.postalCode,
      country: DEFAULT_PLATFORM_BRANDING.country,
      socialLinks: DEFAULT_PLATFORM_BRANDING.socialLinks,
      updatedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning(platformBrandingColumns);

  return inserted[0] ? rowToPlatformBranding(inserted[0]) : null;
}

/** Persists a full merged branding record (singleton row). */
export async function upsertPlatformBrandingRow(
  next: PlatformBrandingSettings,
  id = GLOBAL_BRANDING_ID,
): Promise<PlatformBrandingSettings> {
  const updatedAt = new Date();
  const values = {
    id,
    productName: next.productName,
    consoleTitle: next.consoleTitle,
    tagline: next.tagline,
    primaryColor: next.primaryColor,
    secondaryColor: next.secondaryColor,
    cornerStyle: next.cornerStyle,
    logoUrl: next.logoUrl,
    faviconUrl: next.faviconUrl,
    footerText: next.footerText,
    email: next.email,
    phone: next.phone,
    website: next.website,
    legalName: next.legalName,
    registrationNumber: next.registrationNumber,
    addressLine1: next.addressLine1,
    addressLine2: next.addressLine2,
    city: next.city,
    region: next.region,
    postalCode: next.postalCode,
    country: next.country,
    socialLinks: next.socialLinks,
    updatedAt,
  };

  await activeDb()
    .insert(platformBranding)
    .values(values)
    .onConflictDoUpdate({ target: platformBranding.id, set: values });

  return mergePlatformBranding({ ...next, updatedAt: updatedAt.toISOString() });
}
