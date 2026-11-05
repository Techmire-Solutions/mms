import { scrollAndFocusFirstError } from "@/lib/forms/formAutoScroll";

export interface ContactFieldFocusTarget {
  formInstanceId: string;
  tabId: string;
  fieldId?: string;
  index?: number;
}

/**
 * DOM id candidates for a contact form control.
 *
 * Basic fields render `cf-<instance>-<field>`; sub-list rows render
 * `cf-<instance>-<singular-tab>-<field>-<index>` (phones → phone, emails → email).
 * The bare field id is a last-resort match before the `aria-invalid` fallback.
 */
export function contactFieldCandidateIds({
  formInstanceId,
  tabId,
  fieldId,
  index,
}: ContactFieldFocusTarget): string[] {
  if (!fieldId) return [];
  const singularTab = tabId.replace(/s$/, "");
  const candidates = [
    `cf-${formInstanceId}-${fieldId}`,
    typeof index === "number" ? `cf-${formInstanceId}-${singularTab}-${fieldId}-${index}` : "",
    typeof index === "number" ? `cf-${formInstanceId}-${tabId}-${fieldId}-${index}` : "",
    // Sub-list row card root (FormListFieldCard id) — the helper focuses its first
    // nested control when the row itself is what the error points at.
    typeof index === "number" ? `${formInstanceId}-${tabId}-${index}` : "",
    typeof index === "number" ? `${tabId}-${index}-${fieldId}` : "",
    fieldId,
  ];
  return candidates.filter(Boolean);
}

/**
 * Moves focus to the control that owns a validation error (switching tabs first),
 * so a failed save never leaves the user on the disabled save button hunting for
 * the red field. Falls back to the form's first `aria-invalid` control.
 */
export function focusContactField(target: ContactFieldFocusTarget): void {
  scrollAndFocusFirstError(contactFieldCandidateIds(target), {
    behavior: "smooth",
    block: "center",
    fallbackSelector: '[aria-invalid="true"]',
  });
}
