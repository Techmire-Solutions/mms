import { getRequestTenant } from "../../lib/tenantContext.js";
import { loadContactLookupKind } from "./contactLookupsService.js";
import { loadContactPreferences } from "./contactPreferencesService.js";
import { getWorkspaceBranding } from "../../db/repositories/workspaceRepository.js";

export interface ContactRuntimeDefaults {
  defaultPhoneCountryCode: string;
  phoneLabel: string;
  emailLabel: string;
}

function firstString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function firstCollectionString(rows: unknown[] | null): string {
  return firstString(rows?.[0]);
}

export function resolveDefaultPhoneCountryCode(
  countryCodes: unknown,
  defaultCountry: string,
): string {
  if (!countryCodes || !Array.isArray(countryCodes)) return "";
  let fallbackCode = "";
  for (const entry of countryCodes) {
    if (
      entry &&
      typeof entry === "object" &&
      typeof (entry as { country?: unknown }).country === "string" &&
      typeof (entry as { code?: unknown }).code === "string" &&
      (entry as { code: string }).code
    ) {
      if (defaultCountry && (entry as { country: string }).country === defaultCountry) {
        return (entry as { code: string }).code;
      }
      if (!fallbackCode) {
        fallbackCode = (entry as { code: string }).code;
      }
    }
  }
  return fallbackCode;
}

export async function loadContactRuntimeDefaults(): Promise<ContactRuntimeDefaults> {
  const tenant = getRequestTenant();
  const [countryCodes, phoneLabels, emailLabels, preferences, branding] = await Promise.all([
    loadContactLookupKind("countryCodes"),
    loadContactLookupKind("phoneLabels"),
    loadContactLookupKind("emailLabels"),
    loadContactPreferences(),
    tenant ? getWorkspaceBranding(tenant) : Promise.resolve(null),
  ]);

  const defaultCountry = preferences?.defaultCountry?.trim() || branding?.country?.trim() || "";

  return {
    defaultPhoneCountryCode: resolveDefaultPhoneCountryCode(
      countryCodes as unknown[],
      defaultCountry,
    ),
    phoneLabel: firstCollectionString(phoneLabels as unknown[]),
    emailLabel: firstCollectionString(emailLabels as unknown[]),
  };
}
