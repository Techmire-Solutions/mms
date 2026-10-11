import { z } from "zod";
import { translateApp } from "../appTranslations.js";
import type { AppTranslationKey } from "../appTranslations.js";
import type { FieldDefinition } from "../contactTypes.js";
import { buildCustomFieldSchema } from "../contactValidation.js";
import { isFacultyLockedEnabledTab } from "../moduleFieldSetupPersons.js";
import {
  listEnabledCustomFacultyFormFields,
  listFacultySystemFormFieldKeys,
} from "../facultyFormCustomFields.js";
import { facultyEmployDesignationsWriteSchema } from "../facultyEmployDesignationTypes.js";
import type { FacultySettings } from "../facultyModuleSettings.js";
import { facultyCoreSchema } from "../facultyModuleManifest.js";
import {
  FACULTY_EMPLOYMENT_STATUS_VALUES,
  FACULTY_PROFILE_STATUS_VALUES,
} from "../facultyTypes.js";
import { stripFacultyWriteNoise } from "../facultyUtils.js";
import { deepSanitizeStrings } from "./sanitize.js";

/** Audit / meta keys accepted on faculty writes. */
const FACULTY_WRITE_AUDIT_META_KEYS = [
  "id",
  "userId",
  "createdAt",
  "updatedAt",
  "createdBy",
  "updatedBy",
] as const;

/**
 * Top-level keys accepted on faculty form drafts / writes (no Contacts profile dual-write keys).
 */
export const FACULTY_WRITE_SYSTEM_KEYS: readonly string[] = (() => {
  /** Legacy `joinDate` + employment write-through keys not in form field seed. */
  const extra = ["joinDate", "employmentId", "employDesignations"];
  const keys = new Set<string>([
    ...FACULTY_WRITE_AUDIT_META_KEYS,
    ...listFacultySystemFormFieldKeys(),
    ...extra,
  ]);
  return [...keys].sort((left, right) => left.localeCompare(right));
})();

const isoCalendarDate = /^\d{4}-\d{2}-\d{2}$/;
const optionalCalendarDate = z
  .union([z.string().regex(isoCalendarDate), z.literal("")])
  .nullish()
  .transform((value) => (value === "" ? null : (value ?? null)));

/** Server-computed keys silently dropped from client writes. */
const FACULTY_WRITE_SERVER_OWNED_KEYS = ["performanceRating"] as const;

const FACULTY_WRITE_SYSTEM_KEY_SET = new Set<string>(FACULTY_WRITE_SYSTEM_KEYS);

/** Enabled Setup custom field keys beyond the system faculty model. */
export function collectFacultyWriteExtraFieldKeys(
  fields: Record<string, FieldDefinition[]> | null | undefined,
): string[] {
  if (!fields) return [];
  return listEnabledCustomFacultyFormFields(fields)
    .map((field) => field.key)
    .filter((key) => !FACULTY_WRITE_SYSTEM_KEY_SET.has(key));
}

/**
 * Compiles a Zod validation schema for faculty form drafts / writes.
 * System keys + enabled registry customs; unknown keys rejected via `.strict()`.
 * Contact profile dual-write keys are stripped in preprocess (Contacts SSOT).
 */
export function buildDynamicFacultySchema(
  _settings: FacultySettings,
  enabledTabIds: Set<string>,
  fields: Record<string, FieldDefinition[]>,
  language = "en",
): z.ZodTypeAny {
  const contactRequiredMsg = translateApp(
    "faculty.errorContactRequired" as AppTranslationKey,
    language,
  );
  const requiredMsg = translateApp("common.formPleaseFixErrors" as AppTranslationKey, language);
  const systemKeys = listFacultySystemFormFieldKeys();

  const schemaObject: Record<string, z.ZodTypeAny> = {
    id: z.union([z.string(), z.number()]).optional(),
    contactId: z.union([z.string(), z.number()]).nullish(),
    employmentId: z.string().nullish(),
    employeeId: z.string().nullish(),
    specialization: z.string().nullish(),
    designationId: z.string().nullish(),
    designationStartDate: optionalCalendarDate,
    designationEndDate: optionalCalendarDate,
    status: z.enum(FACULTY_EMPLOYMENT_STATUS_VALUES, { message: requiredMsg }).nullish(),
    profileStatus: z.enum(FACULTY_PROFILE_STATUS_VALUES).nullish(),
    employDesignationStatus: z.enum(FACULTY_PROFILE_STATUS_VALUES).nullish(),
    employDesignationId: z.string().nullish(),
    employDesignations: facultyEmployDesignationsWriteSchema.optional(),
    employmentStartDate: optionalCalendarDate,
    employmentEndDate: optionalCalendarDate,
    joinDate: optionalCalendarDate,
    qualification: z.string().nullish(),
    notes: z.string().nullish(),
    userId: z.string().nullable().nullish(),
    createdAt: z.string().nullish(),
    updatedAt: z.string().nullish(),
    createdBy: z.string().nullish(),
    updatedBy: z.string().nullish(),
  };

  const applyRequiredString = (key: string, required: boolean) => {
    schemaObject[key] = required
      ? z.string({ message: requiredMsg }).min(1, requiredMsg)
      : z.string().nullish();
  };
  const applyRequiredDate = (key: string, required: boolean) => {
    schemaObject[key] = required
      ? z.string({ message: requiredMsg }).regex(isoCalendarDate, requiredMsg)
      : optionalCalendarDate;
  };

  Object.entries(fields).forEach(([tabId, tabFields]) => {
    if (!isFacultyLockedEnabledTab(tabId) && !enabledTabIds.has(tabId)) return;

    for (const field of tabFields) {
      if (!field.enabled) continue;

      if (
        field.key === "contactId" ||
        field.key === "designationId" ||
        field.key === "performanceRating"
      )
        continue;
      if (systemKeys.has(field.key)) {
        const required = Boolean(field.required);
        if (field.key === "status") {
          schemaObject.status = required
            ? z.enum(FACULTY_EMPLOYMENT_STATUS_VALUES, { message: requiredMsg })
            : z.enum(FACULTY_EMPLOYMENT_STATUS_VALUES).nullish();
        } else if (field.key === "employDesignationStatus" || field.key === "profileStatus") {
          const statusSchema = required
            ? z.enum(FACULTY_PROFILE_STATUS_VALUES, { message: requiredMsg })
            : z.enum(FACULTY_PROFILE_STATUS_VALUES).nullish();
          schemaObject.employDesignationStatus = statusSchema;
          schemaObject.profileStatus = statusSchema;
        } else if (
          field.key === "employmentStartDate" ||
          field.key === "employmentEndDate" ||
          field.key === "designationStartDate" ||
          field.key === "designationEndDate"
        ) {
          applyRequiredDate(field.key, required);
        } else if (field.key === "specialization" || field.key === "qualification") {
          applyRequiredString(field.key, false); // contact-derived
        } else if (field.key === "employeeId" || field.key === "notes") {
          applyRequiredString(field.key, required);
        }
        continue;
      }
      schemaObject[field.key] = buildCustomFieldSchema(field, language);
    }
  });

  for (const field of listEnabledCustomFacultyFormFields(fields)) {
    if (schemaObject[field.key]) continue;
    schemaObject[field.key] = buildCustomFieldSchema(field, language);
  }

  schemaObject.contactId = z
    .union([z.string(), z.number()], { error: contactRequiredMsg })
    .refine((value) => value !== null && value !== undefined && value !== "", {
      message: contactRequiredMsg,
    });
  schemaObject.designationId = z.string({ message: requiredMsg }).min(1, requiredMsg);

  const objectSchema = z
    .object(schemaObject)
    .strict()
    .superRefine((data, ctx) => {
      const record = data as Record<string, unknown>;
      const start = record.employmentStartDate ?? record.joinDate;
      const end = record.employmentEndDate;
      if (typeof start === "string" && typeof end === "string" && end < start) {
        ctx.addIssue({
          code: "custom",
          path: ["employmentEndDate"],
          message: translateApp(
            "faculty.errorEmploymentEndBeforeStart" as AppTranslationKey,
            language,
          ),
        });
      }
      const desigStart = record.designationStartDate;
      const desigEnd = record.designationEndDate;
      if (typeof desigStart === "string" && typeof desigEnd === "string" && desigEnd < desigStart) {
        ctx.addIssue({
          code: "custom",
          path: ["designationEndDate"],
          message: translateApp(
            "faculty.errorDesignationEndBeforeStart" as AppTranslationKey,
            language,
          ),
        });
      }
    });

  return z.preprocess((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    const stripped = stripFacultyWriteNoise(raw as Record<string, unknown>);
    for (const key of FACULTY_WRITE_SERVER_OWNED_KEYS) delete stripped[key];
    return deepSanitizeStrings(stripped);
  }, objectSchema);
}

const facultyDuplicateCheckBodyBaseSchema = z
  .object({
    excludeId: z.string().optional(),
    contactId: z.union([z.string(), z.number()]).optional(),
    employeeId: z.string().max(64).optional(),
  })
  .strict();

export type FacultyDuplicateCheckBody = z.infer<typeof facultyDuplicateCheckBodyBaseSchema>;

export const facultyDuplicateCheckBodySchema: z.ZodType<FacultyDuplicateCheckBody> = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    return deepSanitizeStrings(raw);
  },
  facultyDuplicateCheckBodyBaseSchema,
);

/** Person-level reporting / denorm role keys — never persist on faculty writes. */
const FACULTY_WRITE_STRIP_KEYS = [
  "department",
  "departmentId",
  "designation",
  "parentDesignationId",
  "reportingFacultyId",
  "reportingFacultyName",
  "reportingRole",
  "reportingRoleId",
  "reportingDesignationId",
  "hierarchyRank",
  "subordinateCount",
  ...FACULTY_WRITE_SERVER_OWNED_KEYS,
] as const;

export const facultyWriteSchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  const stripped = stripFacultyWriteNoise(raw as Record<string, unknown>);
  for (const key of FACULTY_WRITE_STRIP_KEYS) {
    delete stripped[key];
  }
  return deepSanitizeStrings(stripped);
}, facultyCoreSchema);

export type FacultyWrite = z.infer<typeof facultyWriteSchema>;
