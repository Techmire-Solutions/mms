/** Retired contact classification / CRM keys and seed sanitizers. */

/**
 * Contact classification keys retired from the product SSOT.
 * Contacts are persons — workspace roles and module memberships live on Users /
 * Teachers / Students. Never seed, display, or reintroduce these as contact system fields.
 */
export const CONTACT_RETIRED_CLASSIFICATION_KEYS = ["lifecycleStage", "persona"] as const;

/** @mms/shared object/collection keys retired with contact lifecycle CRM. */
export const CONTACT_RETIRED_OBJECT_KEYS = ["lifecycleColors", "lifecycleStages"] as const;

export type ContactRetiredClassificationKey = (typeof CONTACT_RETIRED_CLASSIFICATION_KEYS)[number];

const CONTACT_RETIRED_CLASSIFICATION_KEY_SET = new Set<string>(CONTACT_RETIRED_CLASSIFICATION_KEYS);

/** True when `key` is a retired contact classification field. */
export function isContactRetiredClassificationKey(
  key: string,
): key is ContactRetiredClassificationKey {
  return CONTACT_RETIRED_CLASSIFICATION_KEY_SET.has(key);
}

/** Strip retired classification keys from a contact-shaped record (seed/save sanitizer). */
export function stripContactRetiredClassificationFields<T extends Record<string, unknown>>(
  data: T,
): T {
  const next: Record<string, unknown> = { ...data };
  for (const key of CONTACT_RETIRED_CLASSIFICATION_KEYS) {
    delete next[key];
  }
  return next as T;
}

/**
 * Remove retired lifecycle CRM objects and classification columns/fields from
 * seed or onboard default objects. Single gate used by backend seed loaders.
 */
export function sanitizeContactSeedObjects(
  objects: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...objects };
  for (const key of CONTACT_RETIRED_OBJECT_KEYS) {
    delete next[key];
  }

  for (const objectKey of Object.keys(next)) {
    if (!objectKey.includes("contact_field_config")) continue;
    const raw = next[objectKey];
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const config: Record<string, unknown> = { ...(raw as Record<string, unknown>) };

    if (Array.isArray(config.columnRegistry)) {
      config.columnRegistry = config.columnRegistry.filter((column) => {
        if (!column || typeof column !== "object") return true;
        const key = (column as { key?: unknown }).key;
        return typeof key !== "string" || !isContactRetiredClassificationKey(key);
      });
    }

    if (config.fields && typeof config.fields === "object" && !Array.isArray(config.fields)) {
      const fields: Record<string, unknown> = {
        ...(config.fields as Record<string, unknown>),
      };
      for (const [tabKey, tabFields] of Object.entries(fields)) {
        if (!Array.isArray(tabFields)) continue;
        fields[tabKey] = tabFields.filter((field) => {
          if (!field || typeof field !== "object") return true;
          const key = (field as { key?: unknown }).key;
          return typeof key !== "string" || !isContactRetiredClassificationKey(key);
        });
      }
      config.fields = fields;
    }

    next[objectKey] = config;
  }

  return next;
}
