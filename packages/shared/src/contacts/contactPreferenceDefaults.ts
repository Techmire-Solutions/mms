/** Contact preference defaults — stable barrel (constants + relationship pairs + normalize). */
import type { ContactPreferences } from "./contactFieldSchemaTypes.js";
import { COLOR_PALETTES } from "./contactPreferenceConstants.js";
import {
  DEFAULT_RELATIONSHIP_PAIRS,
  deriveRelationshipOptionsFromPairs,
  resolveRelationshipPairs,
  sanitizeRelationshipOptionOrder,
} from "./contactRelationshipPairUtils.js";

export * from "./contactPreferenceConstants.js";
export * from "./contactRelationshipPairUtils.js";

export const DEFAULT_CONTACT_PREFERENCES: ContactPreferences = {
  defaultCountry: "",
  defaultProvince: "",
  defaultCity: "",
  defaultViewLayout: "list",
  duplicateDetectionFields: ["name", "phone", "email"],
  duplicateDetectionThresholdHigh: 90,
  duplicateDetectionThresholdMedium: 75,
  duplicateDetectionColorHigh: COLOR_PALETTES.destructive.bg,
  duplicateDetectionColorMedium: COLOR_PALETTES.warning.bg,
  duplicateDetectionColorLow: COLOR_PALETTES.slate.bg,
  duplicateDetectionScorePhoneEmail: 99,
  duplicateDetectionScoreNamePhone: 95,
  duplicateDetectionScoreNameEmail: 95,
  duplicateDetectionScorePhone: 80,
  duplicateDetectionScoreEmail: 80,
  duplicateDetectionScoreName: 75,
  duplicateDetectionScoreDefault: 70,
  duplicateDetectionColorWarning: COLOR_PALETTES.warning.bg,
  duplicateDetectionColorWarningText: COLOR_PALETTES.warning.text,
  duplicateDetectionColorSuccess: COLOR_PALETTES.success.bg,
  duplicateDetectionColorSuccessText: COLOR_PALETTES.success.text,
  duplicateDetectionColorHighlight: COLOR_PALETTES.info.bg,
  showDetailedSolarAge: true,
  showLunarDob: false,
  showDetailedLunarAge: false,
  namePrefixesToIgnore: ["syed", "syeda"],
  relationshipPairs: DEFAULT_RELATIONSHIP_PAIRS,
  relationshipOptionOrder: [],
};

/**
 * Merges stored contact preferences onto defaults.
 * Relationship pairs always resolve to the fixed system catalog
 * ({@link resolveRelationshipPairs}). Option order is sanitized to
 * the current pair-derived label set.
 */
export function normalizeContactPreferences(
  partial?: Partial<ContactPreferences> | null,
): ContactPreferences {
  const merged: ContactPreferences = {
    ...DEFAULT_CONTACT_PREFERENCES,
    ...(partial && typeof partial === "object" && !Array.isArray(partial) ? partial : {}),
  };
  merged.relationshipPairs = resolveRelationshipPairs(merged.relationshipPairs);
  const labels = deriveRelationshipOptionsFromPairs(merged.relationshipPairs);
  merged.relationshipOptionOrder = sanitizeRelationshipOptionOrder(
    merged.relationshipOptionOrder,
    labels,
  );
  return merged;
}
