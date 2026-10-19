import type { Workspace, BrandingSettings } from "@mms/shared";
import type { workspaces as workspacesTable } from "../schema.js";

export function rowToWorkspace(ws: {
  id: string;
  subdomain: string;
  madrasaName: string;
  tagline?: string | null;
  country?: string | null;
  industryType?: string | null;
  enabled: boolean;
  createdAt: Date;
}): Workspace {
  const item: Workspace = {
    id: ws.id,
    subdomain: ws.subdomain,
    madrasaName: ws.madrasaName,
    enabled: ws.enabled,
    createdAt: ws.createdAt.toISOString(),
  };
  if (ws.tagline) item.tagline = ws.tagline;
  if (ws.country) item.country = ws.country;
  if (ws.industryType) item.industryType = ws.industryType;
  return item;
}

/** Map nullable workspace columns back to a BrandingSettings shape. */
export function rowToBranding(ws: typeof workspacesTable.$inferSelect): BrandingSettings {
  return {
    madrasaName: ws.madrasaName,
    tagline: ws.tagline ?? "",
    primaryColor: ws.primaryColor ?? "",
    secondaryColor: ws.secondaryColor ?? "",
    cornerStyle: (ws.cornerStyle as BrandingSettings["cornerStyle"]) ?? "rounded",
    logoUrl: ws.logoUrl ?? "",
    faviconUrl: ws.faviconUrl ?? "",
    footerText: ws.footerText ?? "",
    email: ws.email ?? "",
    phone: ws.phone ?? "",
    website: ws.website ?? "",
    legalName: ws.legalName ?? "",
    registrationNumber: ws.registrationNumber ?? "",
    addressLine1: ws.addressLine1 ?? "",
    addressLine2: ws.addressLine2 ?? "",
    city: ws.city ?? "",
    region: ws.region ?? "",
    postalCode: ws.postalCode ?? "",
    country: ws.country ?? "",
    socialLinks: (ws.socialLinks as BrandingSettings["socialLinks"]) ?? [],
  };
}
