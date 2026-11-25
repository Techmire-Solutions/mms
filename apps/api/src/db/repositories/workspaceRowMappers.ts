import type { Workspace, BrandingSettings } from "@mms/contracts";
import type { workspaces as workspacesTable } from "@mms/db/schema";

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

/** Console-side provisioning record of the tenant's apex admin. */
export interface ProvisionedWorkspaceAdmin {
  name?: string;
  email?: string;
  gender?: string;
}

/**
 * Map the `workspaces` provisioning-admin columns. Returns null when the row has no
 * provisioning record (legacy workspaces created before the columns existed).
 */
export function rowToProvisionedAdmin(ws: {
  adminName?: string | null;
  adminEmail?: string | null;
  adminGender?: string | null;
}): ProvisionedWorkspaceAdmin | null {
  const name = ws.adminName?.trim() || undefined;
  const email = ws.adminEmail?.trim() || undefined;
  const gender = ws.adminGender?.trim() || undefined;
  if (!name && !email && !gender) return null;
  return {
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    ...(gender ? { gender } : {}),
  };
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
