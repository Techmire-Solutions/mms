import { scrollAndFocusFirstError } from "@mms/fe-core/forms/formAutoScroll";

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
const SINGULAR_TAB_MAP: Record<string, string> = {
  addresses: "address",
  bankDetails: "bank",
  phones: "phone",
  emails: "email",
  socials: "social",
  skills: "skill",
};

const BANK_FIELD_ID_MAP: Record<string, string> = {
  bankName: "name",
  accountTitle: "title",
  accountNumber: "acc-no",
};

export function contactFieldCandidateIds({
  formInstanceId,
  tabId,
  fieldId,
  index,
}: ContactFieldFocusTarget): string[] {
  if (!fieldId) return [];
  const singularTab = SINGULAR_TAB_MAP[tabId] ?? tabId.replace(/s$/, "");
  const mappedField = tabId === "bankDetails" ? (BANK_FIELD_ID_MAP[fieldId] ?? fieldId) : fieldId;
  const candidates = [
    `cf-${formInstanceId}-${fieldId}`,
    typeof index === "number" ? `cf-${formInstanceId}-${singularTab}-${mappedField}-${index}` : "",
    typeof index === "number" ? `cf-${formInstanceId}-${singularTab}-${fieldId}-${index}` : "",
    typeof index === "number" ? `cf-${formInstanceId}-${tabId}-${fieldId}-${index}` : "",
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
