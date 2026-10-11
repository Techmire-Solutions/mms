/**
 * Cross-contact uniqueness conflict detection for Setup fields marked `unique: true`.
 */
import { translateApp, translateAppParams } from "./appTranslations.js";
import type { Contact } from "./contactEntityTypes.js";
import type { FieldDefinition } from "./contactFieldSchemaTypes.js";
import type { ValidationError } from "./contactValidationErrors.js";
import {
  collectUniqueContactFieldValues,
  listUniqueContactFieldRefs,
  type UniqueContactFieldValue,
} from "./contactUniqueFieldValues.js";

function resolveFieldLabel(field: FieldDefinition, language: string): string {
  if (field.labelKey) {
    return translateApp(field.labelKey, language);
  }
  return field.label || field.key;
}

function conflictMessage(field: FieldDefinition, language: string): string {
  return translateAppParams("contacts.validation.mustBeUnique", language, {
    label: resolveFieldLabel(field, language),
  });
}

function contactIdKey(contact: Partial<Contact>): string {
  return contact.id == null ? "" : String(contact.id);
}

/**
 * Returns validation errors when the candidate reuses a unique-marked value
 * already present on another active peer, or twice within itself.
 */
export function findContactUniqueFieldConflicts(
  candidate: Partial<Contact>,
  peers: ReadonlyArray<Partial<Contact>>,
  fields: Record<string, FieldDefinition[]>,
  language = "en",
  options?: { defaultPhoneCountryCode?: string; excludeContactIds?: Array<string | number> },
): ValidationError[] {
  const uniqueFields = listUniqueContactFieldRefs(fields);
  if (uniqueFields.length === 0) return [];

  const fieldByKey = new Map(
    uniqueFields.map((ref) => [`${ref.tabId}:${ref.fieldKey}`, ref.field] as const),
  );
  const collectOptions = {
    defaultPhoneCountryCode: options?.defaultPhoneCountryCode,
  };

  const candidateValues = collectUniqueContactFieldValues(candidate, uniqueFields, collectOptions);
  if (candidateValues.length === 0) return [];

  const errors: ValidationError[] = [];
  const seenInCandidate = new Map<string, UniqueContactFieldValue>();

  for (const value of candidateValues) {
    const composite = `${value.tabId}:${value.fieldKey}:${value.normalized}`;
    const prior = seenInCandidate.get(composite);
    if (prior) {
      const field = fieldByKey.get(`${value.tabId}:${value.fieldKey}`);
      if (field) {
        errors.push({
          fieldId: value.fieldKey,
          tabId: value.tabId,
          index: value.index,
          message: conflictMessage(field, language),
        });
      }
      continue;
    }
    seenInCandidate.set(composite, value);
  }

  const candidateId = contactIdKey(candidate);
  const excludedIds = new Set(
    (options?.excludeContactIds ?? []).map((id) => String(id)).filter(Boolean),
  );
  if (candidateId) excludedIds.add(candidateId);

  const candidateCompositeSet = new Set(
    candidateValues.map((v) => `${v.tabId}:${v.fieldKey}:${v.normalized}`),
  );

  const peerValues = new Map<string, string>(); // composite → peer id

  for (const peer of peers) {
    if (peer.deletedAt) continue;
    const peerId = contactIdKey(peer);
    if (peerId && excludedIds.has(peerId)) continue;

    for (const value of collectUniqueContactFieldValues(peer, uniqueFields, collectOptions)) {
      const composite = `${value.tabId}:${value.fieldKey}:${value.normalized}`;
      if (candidateCompositeSet.has(composite) && !peerValues.has(composite)) {
        peerValues.set(composite, peerId);
      }
    }
  }

  const reportedErrorKeys = new Set<string>(
    errors.map((e) => `${e.tabId}:${e.fieldId}:${e.index ?? ""}`),
  );

  for (const value of candidateValues) {
    const composite = `${value.tabId}:${value.fieldKey}:${value.normalized}`;
    if (!peerValues.has(composite)) continue;
    const field = fieldByKey.get(`${value.tabId}:${value.fieldKey}`);
    if (!field) continue;
    const errorKey = `${value.tabId}:${value.fieldKey}:${value.index ?? ""}`;
    if (reportedErrorKeys.has(errorKey)) continue;
    reportedErrorKeys.add(errorKey);
    errors.push({
      fieldId: value.fieldKey,
      tabId: value.tabId,
      index: value.index,
      message: conflictMessage(field, language),
    });
  }

  return errors;
}
