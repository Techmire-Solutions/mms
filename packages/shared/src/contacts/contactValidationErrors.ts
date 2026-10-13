import { type z } from "zod";
import { translateAppParams, type AppTranslationKey } from "../i18n/appTranslations.js";
import { isContactCustomCollectionTab } from "./contactEnabledTabs.js";
import type { FieldDefinition } from "./contactTypes.js";

const LIST_TAB_TO_TAB_ID: Record<string, string> = {
  phones: "phones",
  emails: "emails",
  addresses: "addresses",
  socials: "socials",
  education: "education",
  experience: "experience",
  skills: "skills",
  bankDetails: "bankDetails",
  relationshipContacts: "relationship",
  relationships: "relationship",
};

const LIST_TAB_PREFIX_KEYS: Record<string, AppTranslationKey> = {
  phones: "contacts.validation.itemPhone",
  emails: "contacts.validation.itemEmail",
  addresses: "contacts.validation.itemAddress",
  socials: "contacts.validation.itemSocial",
  education: "contacts.validation.itemEducation",
  experience: "contacts.validation.itemExperience",
  skills: "contacts.validation.itemSkill",
  bankDetails: "contacts.validation.itemBankDetail",
  relationshipContacts: "contacts.validation.itemRelationship",
  relationships: "contacts.validation.itemRelationship",
};

/** Structured contact validation issue mapped to its field and form tab. */
export interface ValidationError {
  fieldId: string;
  tabId: string;
  message: string;
  index?: number;
}

/** Maps Zod issues to contact form fields and tabs. */
export function formatZodIssues(
  error: z.ZodError,
  _submittedValue: unknown,
  fields: Record<string, FieldDefinition[]>,
  language = "en",
): ValidationError[] {
  return error.issues.map((issue) => {
    const [pathRoot, pathIndex, pathField] = issue.path;
    const listTabId =
      typeof pathRoot === "string"
        ? (LIST_TAB_TO_TAB_ID[pathRoot] ??
          (isContactCustomCollectionTab(pathRoot) ? pathRoot : undefined))
        : undefined;
    if (typeof pathRoot === "string" && listTabId && typeof pathIndex === "number") {
      const prefixKey = LIST_TAB_PREFIX_KEYS[pathRoot] ?? "contacts.validation.itemGeneric";
      const prefix = translateAppParams(prefixKey, language, {
        index: pathIndex + 1,
      });
      return {
        fieldId: String(pathField ?? ""),
        tabId: listTabId,
        message: `${prefix}: ${issue.message}`,
        index: pathIndex,
      };
    }

    const fieldId = String(pathRoot ?? "");
    const tabId =
      Object.entries(fields).find(([, tabFields]) =>
        tabFields.some((field) => field.key === fieldId),
      )?.[0] ?? "basic";
    return { fieldId, tabId, message: issue.message };
  });
}
