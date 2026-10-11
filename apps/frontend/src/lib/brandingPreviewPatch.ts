import { pickBrandingFields, type BrandingSettings } from "@mms/shared";

/** Always live-preview theme colours & corner style when identity fields change (logo → colours). */
export const BRANDING_COLOUR_PREVIEW_KEYS = [
  "primaryColor",
  "secondaryColor",
  "cornerStyle",
] as const satisfies readonly (keyof BrandingSettings)[];

/** Build branding preview patch; theme colours included even for identity-only drafts. */
export function buildBrandingPreviewPatch(
  merged: BrandingSettings,
  trackKeys?: readonly (keyof BrandingSettings)[],
): Partial<BrandingSettings> {
  if (!trackKeys) return merged;
  return {
    ...pickBrandingFields(merged, trackKeys),
    ...pickBrandingFields(merged, BRANDING_COLOUR_PREVIEW_KEYS),
  };
}
