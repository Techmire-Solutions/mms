import {
  applyRelationshipOptionOrder,
  deriveRelationshipOptionsFromPairs,
  type FieldConfig,
  type FieldDefinition,
  type RelationshipPair,
} from "@mms/shared";
import {
  loadContactFieldConfig,
  saveContactFieldConfig,
} from "../contacts/use-cases/contactConfigService.js";
import {
  loadContactLookupKind,
  replaceContactLookupKind,
} from "../contacts/use-cases/contactLookupsService.js";

function relationshipLabelListsMatch(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const rightKeys = new Set(right.map((label) => label.trim().toLowerCase()));
  if (rightKeys.size !== left.length) return false;
  return left.every((label) => rightKeys.has(label.trim().toLowerCase()));
}

function relationshipLabelSequencesMatch(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every(
    (label, index) => label.trim().toLowerCase() === (right[index] ?? "").trim().toLowerCase(),
  );
}

function syncRelationshipOptionsInFieldConfig(config: FieldConfig, options: string[]): FieldConfig {
  const tabFields = config.fields?.relationship;
  if (!Array.isArray(tabFields)) return config;
  let changed = false;
  const nextFields: FieldDefinition[] = tabFields.map((field) => {
    if (field.key !== "relationship") return field;
    const current = Array.isArray(field.options) ? field.options : [];
    if (relationshipLabelListsMatch(current, options)) return field;
    changed = true;
    return { ...field, options };
  });
  if (!changed) return config;
  return {
    ...config,
    fields: {
      ...config.fields,
      relationship: nextFields,
    },
  };
}

/** Align lookups + field-config options with pair-derived relationship labels. */
export async function syncRelationshipMirrorsFromPairs(
  pairs: RelationshipPair[] | undefined,
  optionOrder?: string[] | null,
): Promise<string[]> {
  const labels = applyRelationshipOptionOrder(
    deriveRelationshipOptionsFromPairs(pairs ?? []),
    optionOrder,
  );
  const currentLookups = await loadContactLookupKind("relationships");
  const lookupLabels = Array.isArray(currentLookups)
    ? currentLookups.filter((entry): entry is string => typeof entry === "string")
    : [];
  if (!relationshipLabelSequencesMatch(lookupLabels, labels)) {
    await replaceContactLookupKind("relationships", labels);
  }

  const fieldConfig = await loadContactFieldConfig();
  if (fieldConfig) {
    const synced = syncRelationshipOptionsInFieldConfig(fieldConfig, labels);
    if (synced !== fieldConfig) {
      await saveContactFieldConfig(synced);
    }
  }
  return labels;
}
