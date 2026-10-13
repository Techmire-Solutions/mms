import type { Contact, FieldConfig } from "./contactTypes.js";
import { isContactLockedEnabledTab } from "./contactEnabledTabs.js";

const LIST_TAB_DATA_KEYS: Record<string, string> = {
  phones: "phones",
  emails: "emails",
  addresses: "addresses",
  socials: "socials",
  relationship: "relationshipContacts",
};

const COMPLETENESS_SKIP_TYPES = new Set(["boolean", "ai_summary"]);

function isCompletenessTabActive(tab: { key: string; enabled?: boolean }): boolean {
  return tab.enabled !== false || isContactLockedEnabledTab(tab.key);
}

/** Returns true when a form field value is considered filled. */
export function hasFieldValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !Number.isNaN(value);
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") {
    const valueObject = value as Record<string, unknown>;
    if ("url" in valueObject) return Boolean(valueObject.url);
    return Object.keys(valueObject).length > 0;
  }
  return false;
}

/** Config-driven profile completeness (0–100) for command-centre metrics. */
export function calculateProfileCompleteness(
  contact: Partial<Contact>,
  fieldConfig: FieldConfig,
): number {
  const fields = fieldConfig.fields || {};
  const formTabs = (fieldConfig.formTabs || []).filter(isCompletenessTabActive);
  const record = contact as Record<string, unknown>;

  let totalRequired = 0;
  let filledRequired = 0;
  let totalOptional = 0;
  let filledOptional = 0;

  for (const tab of formTabs) {
    const listKey = LIST_TAB_DATA_KEYS[tab.key];
    if (listKey) {
      const isRequired = (fieldConfig.requiredTabs || []).includes(tab.key);
      const list = record[listKey];
      const isFilled = Array.isArray(list) && list.length > 0;
      if (isRequired) {
        totalRequired += 1;
        if (isFilled) filledRequired += 1;
      } else {
        totalOptional += 1;
        if (isFilled) filledOptional += 1;
      }
      continue;
    }
    const tabFields = (fields[tab.key] || []).filter(
      (field) => field.enabled && !COMPLETENESS_SKIP_TYPES.has(field.type),
    );
    for (const field of tabFields) {
      const isFilled = hasFieldValue(record[field.key]);
      if (field.required) {
        totalRequired += 1;
        if (isFilled) filledRequired += 1;
      } else {
        totalOptional += 1;
        if (isFilled) filledOptional += 1;
      }
    }
  }

  const reqRatio = totalRequired === 0 ? 0 : filledRequired / totalRequired;
  const optRatio = totalOptional === 0 ? 0 : filledOptional / totalOptional;

  const progress =
    totalRequired === 0
      ? optRatio
      : totalOptional === 0
        ? reqRatio
        : reqRatio * 0.7 + optRatio * 0.3;

  return Math.round(progress * 100);
}
