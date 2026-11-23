import { mergeBrandingSettings, type BrandingSettings } from "@mms/shared";
import { apiFetch } from "@/lib/apiClient";
import { readObjectLocal, writeObjectLocal } from "@/lib/dbObjectStorage";

/**
 * Tenant branding hydration.
 *
 * Public branding (name/tagline/logo/colours) is cached from the workspace lookup,
 * but the institution identity — contact, legal name, registration number, address
 * and social links — exists only in PostgreSQL. Without hydration the Settings →
 * Institution form starts empty on a fresh browser and the next save would overwrite
 * the stored values. Branding writers (admin/super admin) therefore hydrate the full
 * record from the tenant object endpoint (non-writers receive the redacted subset
 * from the same endpoint and keep the public cache).
 */
export async function fetchBrandingFromServer(): Promise<BrandingSettings | null> {
  try {
    const response = await apiFetch("/api/db/objects/branding");
    if (!response.ok) return null;
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return mergeBrandingSettings(body as Partial<BrandingSettings>);
  } catch {
    return null;
  }
}

/** Copies the persisted branding record into the device-local store. Fail-open. */
export async function hydrateBrandingFromServer(): Promise<boolean> {
  const serverBranding = await fetchBrandingFromServer();
  if (!serverBranding) return false;
  const current = readObjectLocal<BrandingSettings>("branding");
  if (
    current &&
    JSON.stringify(mergeBrandingSettings(current)) === JSON.stringify(serverBranding)
  ) {
    return true;
  }
  writeObjectLocal("branding", serverBranding);
  return true;
}
