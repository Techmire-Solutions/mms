import { z } from "zod";
import { translateApp, type AppTranslationKey } from "../i18n/appTranslations.js";
import { canViewContactField, canViewContactTab } from "./contactFieldAccess.js";
import { isContactCustomCollectionTab } from "./contactEnabledTabs.js";
import { buildCustomFieldSchema } from "./contactFieldValidation.js";
import { relationshipSchema, activitySchema, attachmentSchema } from "./contactNestedSchemas.js";
import type { FieldConfig, FieldDefinition } from "./contactTypes.js";

const REQUIRED_TAB_I18N: Partial<Record<string, AppTranslationKey>> = {
  phones: "contacts.form.atLeastOnePhoneRequired",
  emails: "contacts.form.atLeastOneEmailRequired",
  addresses: "contacts.form.atLeastOneAddressRequired",
  socials: "contacts.form.atLeastOneSocialRequired",
  education: "contacts.form.atLeastOneEducationRequired",
  experience: "contacts.form.atLeastOneExperienceRequired",
  skills: "contacts.form.atLeastOneSkillRequired",
  relationship: "contacts.form.atLeastOneRelationshipRequired",
};

const LIST_TABS_PROP_MAP: Record<string, string> = {
  phones: "phones",
  emails: "emails",
  addresses: "addresses",
  socials: "socials",
  education: "education",
  experience: "experience",
  skills: "skills",
  relationship: "relationshipContacts",
};

/** Compiles the active contact field configuration into a Zod object schema. */
export function buildDynamicContactSchema(
  config: FieldConfig,
  enabledTabIds: Set<string>,
  requiredTabIds: Set<string>,
  fields: Record<string, FieldDefinition[]>,
  language = "en",
  viewerRole?: string,
): z.ZodTypeAny {
  const schemaObject: Record<string, z.ZodTypeAny> = {
    id: z.union([z.string(), z.number()]).optional(),
    relationships: z.array(relationshipSchema).optional().nullable(),
    activities: z.array(activitySchema).optional().nullable(),
    attachments: z.array(attachmentSchema).optional().nullable(),
  };

  for (const [tabId, configuredFields] of Object.entries(fields)) {
    if (LIST_TABS_PROP_MAP[tabId] || isContactCustomCollectionTab(tabId)) continue;
    if (!enabledTabIds.has(tabId) && tabId !== "basic") continue;

    const tabDefinition = config.formTabs?.find((tab) => tab.key === tabId);
    if (viewerRole && tabDefinition && !canViewContactTab(viewerRole, tabDefinition)) {
      continue;
    }

    for (const field of configuredFields) {
      if (!field.enabled || (viewerRole && !canViewContactField(viewerRole, field))) {
        continue;
      }
      schemaObject[field.key] = buildCustomFieldSchema(field, language);
    }
  }

  const listTabEntries: Array<[string, string]> = [
    ...Object.entries(LIST_TABS_PROP_MAP),
    ...Object.keys(fields)
      .filter((tabId) => isContactCustomCollectionTab(tabId))
      .map((tabId): [string, string] => [tabId, tabId]),
  ];

  for (const [tabId, propertyKey] of listTabEntries) {
    if (!enabledTabIds.has(tabId)) continue;

    const tabDefinition = config.formTabs?.find((tab) => tab.key === tabId);
    if (viewerRole && tabDefinition && !canViewContactTab(viewerRole, tabDefinition)) {
      continue;
    }

    const itemSchemaObject: Record<string, z.ZodTypeAny> = {};
    for (const field of fields[tabId] ?? []) {
      if (!field.enabled || (viewerRole && !canViewContactField(viewerRole, field))) {
        continue;
      }
      itemSchemaObject[field.key] = buildCustomFieldSchema(field, language);
    }

    const itemSchema = z.object(itemSchemaObject);
    if (requiredTabIds.has(tabId)) {
      const translationKey = REQUIRED_TAB_I18N[tabId];
      const message = translationKey
        ? translateApp(translationKey, language)
        : translateApp("contacts.form.atLeastOneEntryRequired", language);
      schemaObject[propertyKey] = z.array(itemSchema).min(1, message);
    } else {
      schemaObject[propertyKey] = z.array(itemSchema).optional().nullable();
    }
  }

  return z.object(schemaObject).passthrough();
}
