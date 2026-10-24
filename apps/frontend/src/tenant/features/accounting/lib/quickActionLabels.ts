import type { AppTranslationKey } from "@mms/shared";
import type { QuickActionType } from "./journalEntriesQuickActions";

type Translate = (key: AppTranslationKey) => string;

/** Display label of a wizard transaction type: a template's own name, else its translation key. */
export function quickActionLabel(
  type: Pick<QuickActionType, "label" | "labelKey">,
  t: Translate,
): string {
  return type.label ?? t(type.labelKey);
}

/** Default narration of a wizard transaction type. */
export function quickActionDescription(
  type: Pick<QuickActionType, "description" | "descriptionKey">,
  t: Translate,
): string {
  return type.description ?? t(type.descriptionKey);
}
