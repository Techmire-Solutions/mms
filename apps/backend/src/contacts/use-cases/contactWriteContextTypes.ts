import type { FieldConfig } from "@mms/shared";
import type { ContactRuntimeDefaults } from "./contactRuntimeDefaults.js";

/** Country-code lookup rows exactly as the contacts lookup service returns them. */
export type ContactCountryCodeRow = { country?: string; code?: string } | string;

/**
 * Tenant configuration a contact write needs: runtime defaults (phone dialling
 * code, default labels), the country-code lookup and the Setup field config.
 *
 * Loading these reads costs ~10 queries per write, and a batch write used to pay
 * that cost **per contact** inside a single transaction. Callers load the
 * bundle once and pass it down; every consumer stays correct when it is absent
 * (it then loads lazily, preserving single-record behaviour for callers that
 * have no batch context).
 */
export interface ContactWriteContext {
  runtimeDefaults: ContactRuntimeDefaults;
  countryCodes: readonly ContactCountryCodeRow[];
  fieldConfig: FieldConfig | null;
}
