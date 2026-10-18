/** Shared defaults and helpers for per-row contact item normalizers. */

/** Optional tenant/config defaults for empty-row seeding (falls back to shared DEFAULT_*). */
export interface ContactItemNormalizeDefaults {
  phoneLabel?: string;
  emailLabel?: string;
  addressLabel?: string;
  socialPlatform?: string;
  educationDegree?: string;
  employmentType?: string;
  skillCategory?: string;
  skillProficiency?: string;
  relationship?: string;
  bankLabel?: string;
  defaultPhoneCountryCode?: string;
}

export function retainExtraKeys(
  obj: Record<string, unknown>,
  consumedKeys: ReadonlySet<string>,
): Record<string, unknown> {
  const extras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (consumedKeys.has(key)) continue;
    extras[key] = value;
  }
  return extras;
}
