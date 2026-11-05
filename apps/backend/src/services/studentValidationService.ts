import { type z } from "zod";
import {
  buildDynamicStudentSchema,
  verifyBlueprintVersion,
  getPrimaryPhone,
  getPrimaryEmail,
  resolveStudentGuardianLinks,
  type Contact,
  type FieldDefinition,
  type StudentsSettings,
} from "@mms/shared";
import { loadStudentsSettingsCombined } from "../students/use-cases/studentConfigService.js";
import { loadContactsSummaryByIdsForTenant } from "./contactService.js";

// Cache compiled schema by tenant and config version: `${tenant}:${configVersion}:${language}`
const schemaCache = new Map<string, z.ZodTypeAny>();
const SCHEMA_CACHE_MAX_ENTRIES = 100;

function getSubmittedBlueprintId(student: unknown): unknown {
  if (!student || typeof student !== "object" || Array.isArray(student)) {
    return undefined;
  }
  return (student as Record<string, unknown>)._blueprintId;
}

async function hydrateStudentValidationSubject(
  student: unknown,
  getContactMap: () => Promise<Map<string, Contact>>,
): Promise<unknown> {
  if (!student || typeof student !== "object" || Array.isArray(student)) {
    return student;
  }

  const studentRecord = student as Record<string, unknown>;
  const contactId = studentRecord.contactId;
  if (contactId == null || contactId === "") {
    return studentRecord;
  }

  const contactMap = await getContactMap();
  const contact = contactMap.get(String(contactId));
  if (!contact) {
    return studentRecord;
  }

  return {
    ...studentRecord,
    name: studentRecord.name ?? contact.name,
    gender: studentRecord.gender ?? contact.gender,
    dob: studentRecord.dob ?? contact.dob,
    phone: studentRecord.phone ?? getPrimaryPhone(contact),
    email: studentRecord.email ?? getPrimaryEmail(contact),
    city: studentRecord.city ?? contact.addresses?.[0]?.city ?? null,
    ...resolveStudentGuardianLinks(
      studentRecord as {
        fatherContactId?: string | number;
        motherContactId?: string | number;
        guardianContactId?: string | number;
      },
      contact,
    ),
  };
}

/** A single rejected Setup field, shaped for the HTTP error contract. */
export interface StudentValidationIssue {
  field: string;
  message: string;
}

function toFieldIssues(error: z.ZodError): StudentValidationIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.map(String).join(".") : "form",
    message: issue.message,
  }));
}

interface PreparedValidation {
  schema: z.ZodTypeAny;
  subject: unknown;
}

async function prepareValidation(
  tenant: string,
  student: unknown,
  language: string,
  preloadedSettings?: StudentsSettings | null,
): Promise<PreparedValidation | null> {
  // The route boundary already loaded the composed settings for its allowlist check; reuse them
  // instead of paying the field-config + preferences reads twice per write.
  const settings = preloadedSettings ?? (await loadStudentsSettingsCombined());
  if (!settings) return null;

  // Version Lock check (Rule 16.3 / CS-6)
  const submittedBlueprintId = getSubmittedBlueprintId(student);
  verifyBlueprintVersion(submittedBlueprintId, settings.version || 0);

  const cacheKey = `${tenant}:${settings.version || 0}:${language}`;
  let schema = schemaCache.get(cacheKey);

  if (!schema) {
    const enabledTabIds = new Set(settings.enabledTabs || []);
    const requiredTabIds = new Set(settings.requiredTabs || []);
    const fields = (settings.fields || {}) as Record<string, FieldDefinition[]>;

    schema = buildDynamicStudentSchema(settings, enabledTabIds, requiredTabIds, fields, language);
    if (schemaCache.size >= SCHEMA_CACHE_MAX_ENTRIES) {
      const oldestKey = schemaCache.keys().next().value;
      if (oldestKey) schemaCache.delete(oldestKey);
    }
    schemaCache.set(cacheKey, schema);
  }

  let cachedContactMap: Map<string, Contact> | undefined;
  const getContactMap = async (): Promise<Map<string, Contact>> => {
    if (!cachedContactMap) {
      const subjects = Array.isArray(student) ? student : [student];
      const ids = [
        ...new Set(
          subjects
            .map((item) =>
              item && typeof item === "object" && !Array.isArray(item)
                ? (item as Record<string, unknown>).contactId
                : undefined,
            )
            .filter((id): id is string | number => id != null && id !== "")
            .map(String),
        ),
      ];
      const contacts = ids.length === 0 ? [] : await loadContactsSummaryByIdsForTenant(tenant, ids);
      cachedContactMap = new Map(contacts.map((c) => [String(c.id), c]));
    }
    return cachedContactMap;
  };

  const subject = Array.isArray(student)
    ? await Promise.all(student.map((item) => hydrateStudentValidationSubject(item, getContactMap)))
    : await hydrateStudentValidationSubject(student, getContactMap);

  return { schema, subject };
}

/**
 * Collects per-field validation failures for a student payload against the tenant blueprint.
 *
 * Returns `[]` when the tenant has no field configuration yet (a fresh workspace has nothing to
 * enforce) and throws only when the submitted blueprint version is stale. Writers use this to
 * answer 400 with field-level errors instead of relying on browser validation.
 */
export async function collectStudentDynamicIssues(
  tenant: string,
  student: unknown,
  language = "en",
  preloadedSettings?: StudentsSettings | null,
): Promise<StudentValidationIssue[]> {
  const prepared = await prepareValidation(tenant, student, language, preloadedSettings);
  if (!prepared) return [];
  const results = Array.isArray(prepared.subject)
    ? prepared.subject.map((item) => prepared.schema.safeParse(item))
    : [prepared.schema.safeParse(prepared.subject)];
  return results.flatMap((result) =>
    result.success ? [] : toFieldIssues(result.error as z.ZodError),
  );
}

/**
 * Validates one or more student records against the current tenant's dynamic field blueprint.
 *
 * @param tenant - The workspace subdomain/tenant.
 * @param student - The student record or array of student records to validate.
 * @param language - Optional language code for error message translation.
 * @throws {Error} if validation fails.
 */
export async function validateStudentDynamic(
  tenant: string,
  student: unknown,
  language = "en",
): Promise<void> {
  const issues = await collectStudentDynamicIssues(tenant, student, language);
  if (issues.length > 0) throw new Error(issues.map((issue) => issue.message).join("; "));
}
