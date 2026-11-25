import { formatRelationshipDisplayLabel, type AppTranslationKey } from "@mms/contracts";
import { formatContactOptionLabel } from "@mms/fe-core/lib/contactI18n";

interface LocalizedRelationshipParts {
  /** English gendered display (badge codes). */
  display: string;
  /** Localized label for UI. */
  label: string;
}

/**
 * Gendered Parent/Child/Sibling display once, then Contacts option i18n.
 * Prefer `resolvedGender ?? linkGender` at call sites.
 */
export function formatLocalizedRelationshipParts(
  relationship: string | undefined | null,
  gender: string | null | undefined,
  t: (key: AppTranslationKey) => string,
): LocalizedRelationshipParts {
  const stored = (relationship || "").trim();
  if (!stored) return { display: "", label: "" };
  const display = formatRelationshipDisplayLabel(stored, gender);
  const label = formatContactOptionLabel(display, t) || display;
  return { display, label };
}

/** Localized relationship label (Contacts metadata / network). */
export function formatLocalizedRelationshipLabel(
  relationship: string | undefined | null,
  gender: string | null | undefined,
  t: (key: AppTranslationKey) => string,
): string {
  return formatLocalizedRelationshipParts(relationship, gender, t).label;
}
