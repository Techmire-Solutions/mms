import { z } from "zod";
import { GENDERS } from "./contactPreferenceConstants.js";
import { STUDENT_STATUS_VALUES } from "./studentTypes.js";

/** Students Setup option-list kinds migrated off document-store collections. */
export const STUDENT_LOOKUP_KINDS = ["statuses", "genderFilters", "discountTypes"] as const;

export type StudentLookupKind = (typeof STUDENT_LOOKUP_KINDS)[number];

/** Legacy document-store collection key → typed lookup kind. */
export const STUDENT_LOOKUP_LEGACY_COLLECTION_KEYS = {
  studentStatuses: "statuses",
  studentGenderFilters: "genderFilters",
  studentDiscountTypes: "discountTypes",
} as const satisfies Record<string, StudentLookupKind>;

type StudentLookupLegacyCollectionKey = keyof typeof STUDENT_LOOKUP_LEGACY_COLLECTION_KEYS;

const studentLookupKindSchema = z.enum(STUDENT_LOOKUP_KINDS);

/** Shape of the student per-kind lookup map: string lists for each kind. */
export type StudentLookupsMap = {
  statuses: string[];
  genderFilters: string[];
  discountTypes: string[];
};

/** Schema for validating student lookup kind url parameters. */
export const studentLookupKindParamsSchema = z.object({
  kind: studentLookupKindSchema,
});

/** Schema for validating student lookup put request body. */
export * from "./schemas/studentLookup.dto.js";

const STUDENT_LOOKUP_KINDS_SET = new Set<string>(STUDENT_LOOKUP_KINDS);

/** Type guard checking if a string is a valid StudentLookupKind. */
export function isStudentLookupKind(value: string): value is StudentLookupKind {
  return STUDENT_LOOKUP_KINDS_SET.has(value);
}

/** Type guard checking if a string is a valid legacy collection key for student lookups. */
export function isStudentLookupLegacyCollectionKey(
  value: string,
): value is StudentLookupLegacyCollectionKey {
  return Object.prototype.hasOwnProperty.call(STUDENT_LOOKUP_LEGACY_COLLECTION_KEYS, value);
}

export function defaultStudentLookupItems(kind: StudentLookupKind): string[] {
  switch (kind) {
    case "statuses":
      return [...STUDENT_STATUS_VALUES];
    case "genderFilters":
      return [...GENDERS];
    case "discountTypes":
      return [];
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function emptyStudentLookupsMap(): StudentLookupsMap {
  return {
    statuses: defaultStudentLookupItems("statuses"),
    genderFilters: defaultStudentLookupItems("genderFilters"),
    discountTypes: defaultStudentLookupItems("discountTypes"),
  };
}

/**
 * Field-config target whose `options` mirror each string lookup kind — used both
 * when Setup persists a list and when validation overlays the live list.
 */
export const STUDENT_LOOKUP_FIELD_TARGETS = {
  statuses: { tabId: "registration", fieldId: "status" },
  genderFilters: { tabId: "basic", fieldId: "gender" },
} as const satisfies Record<
  Exclude<StudentLookupKind, "discountTypes">,
  { tabId: string; fieldId: string }
>;

export type StudentLookupStringKind = keyof typeof STUDENT_LOOKUP_FIELD_TARGETS;
