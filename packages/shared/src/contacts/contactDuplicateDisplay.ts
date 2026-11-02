import {
  COLOR_PALETTES,
  DEFAULT_CONTACT_PREFERENCES,
  type ContactPreferences,
} from "./contactTypes.js";

/** Confidence badge styling and tier classification for duplicate pairs. */
export function getDuplicateConfidenceBadgeStyle(
  score: number,
  prefs?: Partial<ContactPreferences>,
): { colorClass: string; labelTier: "high" | "medium" | "low" } {
  const highThreshold =
    prefs?.duplicateDetectionThresholdHigh ??
    DEFAULT_CONTACT_PREFERENCES.duplicateDetectionThresholdHigh!;
  const medThreshold =
    prefs?.duplicateDetectionThresholdMedium ??
    DEFAULT_CONTACT_PREFERENCES.duplicateDetectionThresholdMedium!;
  const highColor =
    prefs?.duplicateDetectionColorHigh ??
    DEFAULT_CONTACT_PREFERENCES.duplicateDetectionColorHigh ??
    COLOR_PALETTES.red.bg;
  const medColor =
    prefs?.duplicateDetectionColorMedium ??
    DEFAULT_CONTACT_PREFERENCES.duplicateDetectionColorMedium ??
    COLOR_PALETTES.amber.bg;
  const lowColor =
    prefs?.duplicateDetectionColorLow ??
    DEFAULT_CONTACT_PREFERENCES.duplicateDetectionColorLow ??
    COLOR_PALETTES.slate.bg;

  if (score >= highThreshold) {
    return { colorClass: highColor, labelTier: "high" };
  }
  if (score >= medThreshold) {
    return { colorClass: medColor, labelTier: "medium" };
  }
  return { colorClass: lowColor, labelTier: "low" };
}
