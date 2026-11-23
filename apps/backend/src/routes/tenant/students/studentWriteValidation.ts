import type { FastifyRequest } from "fastify";
import {
  buildStudentWriteSchema,
  collectStudentWriteExtraFieldKeys,
  resolveStudentContactProfileGaps,
  resolveStudentContactProfileRequirements,
  resolveStudentGuardianLinks,
  translateApp,
  verifyBlueprintVersion,
  type AppTranslationKey,
  type FieldDefinition,
  type StudentRecord,
} from "@mms/shared";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { loadStudentsSettingsCombined } from "../../../students/use-cases/studentConfigService.js";
import { loadContactsByIdsForTenant } from "../../../contacts/use-cases/contactLoadUseCases.js";
import { collectStudentDynamicIssues } from "../../../services/studentValidationService.js";

/** Languages the Setup blueprint can translate its validation messages into. */
const SUPPORTED_LANGUAGES = new Set(["en", "ar", "ur", "fa"]);

/**
 * A rejected student write payload.
 *
 * `mapStudentWriteHttpError` maps this to a 400 `validation_error` carrying `errors[]`, so the
 * client can focus the offending field instead of showing a generic failure.
 */
export class StudentWriteValidationError extends Error {
  readonly statusCode = 400;
  readonly type = "validation_error";
  readonly validationErrors: Array<{ field: string; message: string }>;

  constructor(validationErrors: Array<{ field: string; message: string }>) {
    super(validationErrors[0]?.message ?? "Invalid student payload");
    this.name = "StudentWriteValidationError";
    this.validationErrors = validationErrors;
  }
}

/** The submitted form was rendered against a stale field blueprint. */
export class StudentBlueprintConflictError extends Error {
  readonly statusCode = 409;
  readonly type = "conflict";
  readonly field = "form";

  constructor(message = "The student form configuration changed. Reload the form and try again.") {
    super(message);
    this.name = "StudentBlueprintConflictError";
  }
}

function requestLanguage(request: FastifyRequest): string {
  const header = request.headers["accept-language"];
  const raw = Array.isArray(header) ? header[0] : header;
  const code = (raw ?? "").split(",")[0]?.trim().slice(0, 2).toLowerCase() ?? "";
  return SUPPORTED_LANGUAGES.has(code) ? code : "en";
}

type ZodIssueLike = {
  code?: string;
  keys?: string[];
  path: Array<string | number | symbol>;
  message: string;
};

function issuesFromZod(error: {
  issues: ZodIssueLike[];
}): Array<{ field: string; message: string }> {
  return error.issues.flatMap((issue) => {
    // `.strict()` reports unknown keys as a single root issue; expand it so each key gets a field.
    if (issue.code === "unrecognized_keys" && Array.isArray(issue.keys)) {
      return issue.keys.map((key) => ({ field: key, message: `Unknown field "${key}"` }));
    }
    return [
      {
        field: issue.path.length > 0 ? issue.path.map(String).join(".") : "form",
        message: issue.message,
      },
    ];
  });
}

/**
 * Server-authoritative validation for student create/update.
 *
 * Two layers, in order:
 *   1. the tenant-aware strict allowlist (`buildStudentWriteSchema`) — rejects unknown keys and
 *      strips client soft-delete metadata, allowing only keys the Setup registry publishes;
 *   2. the tenant dynamic blueprint (`collectStudentDynamicIssues`) — required tabs/fields, field
 *      types and the blueprint-version lock.
 *
 * Both used to run at this boundary; a refactor removed them and left the wire schema
 * (`.passthrough()`) as the only check, so any REST client could persist students that violate the
 * workspace configuration.
 *
 * @returns the sanitized payload to persist.
 * @throws {StudentWriteValidationError} on a field-level rejection.
 * @throws {StudentBlueprintConflictError} when the submitted blueprint version is stale.
 */
export async function validateStudentWrite(
  request: FastifyRequest,
  body: unknown,
): Promise<StudentRecord> {
  // Fail closed: a settings read failure must not silently disable the
  // dynamic blueprint (required fields, types and the stale-form lock).
  const settings = await loadStudentsSettingsCombined();
  const schema = buildStudentWriteSchema(collectStudentWriteExtraFieldKeys(settings));
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new StudentWriteValidationError(issuesFromZod(result.error));
  }
  const data = result.data as StudentRecord;

  try {
    verifyBlueprintVersion((data as Record<string, unknown>)._blueprintId, settings?.version ?? 0);
  } catch (error: unknown) {
    throw new StudentBlueprintConflictError(error instanceof Error ? error.message : undefined);
  }

  const tenant = getRequestTenant() ?? String(request.tenant?.id ?? "");
  if (!tenant) {
    // Fail closed: skipping the dynamic blueprint here would let a tenant-less caller persist a
    // record that violates the workspace configuration.
    throw new StudentWriteValidationError([{ field: "form", message: "Tenant context required" }]);
  }
  if (settings) {
    let issues: Array<{ field: string; message: string }>;
    try {
      issues = await collectStudentDynamicIssues(tenant, data, requestLanguage(request), settings);
    } catch (error: unknown) {
      // The blueprint changed between the two loads; treat it like any other stale-form conflict.
      throw new StudentBlueprintConflictError(error instanceof Error ? error.message : undefined);
    }
    if (issues.length > 0) throw new StudentWriteValidationError(issues);

    // Layer 3 — contact-profile completeness. Relationships, address, education, phone
    // and email live on the linked contact, so the Setup required toggles are enforced
    // from that record.
    const profileRequirements = resolveStudentContactProfileRequirements(
      (settings.fields ?? {}) as Record<string, FieldDefinition[]>,
    );
    if (
      profileRequirements.relationships ||
      profileRequirements.address ||
      profileRequirements.education ||
      profileRequirements.phone ||
      profileRequirements.email
    ) {
      const contactId = data.contactId != null ? String(data.contactId).trim() : "";
      const [contact] = contactId ? await loadContactsByIdsForTenant(tenant, [contactId]) : [];
      const triad = resolveStudentGuardianLinks(data, contact ?? null);
      const gaps = resolveStudentContactProfileGaps(contact ?? null, profileRequirements, triad);
      const language = requestLanguage(request);
      const profileIssues: Array<{ field: string; message: string }> = [];
      if (gaps.relationships) {
        profileIssues.push({
          field: "contactRelationships",
          message: translateApp(
            "students.form.relationshipsRequired" as AppTranslationKey,
            language,
          ),
        });
      }
      if (gaps.address) {
        profileIssues.push({
          field: "address",
          message: translateApp("students.form.addressRequired" as AppTranslationKey, language),
        });
      }
      if (gaps.education) {
        profileIssues.push({
          field: "education",
          message: translateApp("students.form.educationRequired" as AppTranslationKey, language),
        });
      }
      if (gaps.phone) {
        profileIssues.push({
          field: "phone",
          message: translateApp("students.form.phoneRequired" as AppTranslationKey, language),
        });
      }
      if (gaps.email) {
        profileIssues.push({
          field: "email",
          message: translateApp("students.form.emailRequired" as AppTranslationKey, language),
        });
      }
      if (profileIssues.length > 0) throw new StudentWriteValidationError(profileIssues);
    }
  }
  return data;
}
