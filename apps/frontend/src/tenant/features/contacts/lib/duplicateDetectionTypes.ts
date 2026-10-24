import type { Contact, ContactPreferences } from "@mms/shared";
import { DEFAULT_CONTACT_PREFERENCES } from "@mms/shared";

export interface DuplicatePair {
  id: string;
  confidence: number;
  reason: string;
  contacts: [Contact, Contact];
}

/** Theme token for “from duplicate” highlight chips in merge preview. */
export function getDuplicateThemeColors(prefs?: Partial<ContactPreferences>) {
  const merged = { ...DEFAULT_CONTACT_PREFERENCES, ...prefs };
  return {
    highlightBg: merged.duplicateDetectionColorHighlight,
  };
}
