import crypto from "node:crypto";
import type { z } from "zod";
import {
  buildDynamicContactSchema,
  formatZodIssues,
  resolveContactEnabledTabIds,
  verifyBlueprintVersion,
  type FieldConfig,
  type ValidationError as ContactValidationIssue,
} from "@mms/shared";
import { ValidationError as HttpValidationError } from "../../lib/httpErrors.js";
import { loadContactFieldConfig } from "./contactConfigService.js";

// Cache compiled schemas by tenant, language, and active blueprint fingerprint (bounded to 100 entries).
const SCHEMA_CACHE_MAX_ENTRIES = 100;
const schemaCache = new Map<string, z.ZodTypeAny>();

/**
 * Rejected contact write, carrying field/tab-level issues.
 *
 * Extends the HTTP `ValidationError` so the write-route formatters answer 400
 * (never 500): `formatContactWriteError` serializes `.errors` when present.
 */
export class ContactBlueprintValidationError extends HttpValidationError {
  readonly code = "blueprint_validation" as const;
  readonly errors: ContactValidationIssue[];

  constructor(message: string, errors: ContactValidationIssue[] = []) {
    super(message);
    this.name = "ContactBlueprintValidationError";
    this.errors = errors;
  }
}

export interface ValidateContactDynamicOptions {
  language?: string;
  viewerRole?: string;
  /**
   * Preloaded tenant configuration. Write use cases already loaded the write
   * context, so passing it here keeps a save at one config read instead of two.
   */
  fieldConfig?: FieldConfig | null;
}

function getBlueprintCacheKey(
  tenant: string,
  fieldConfig: unknown,
  language: string,
  viewerRole?: string,
): string {
  const fingerprint = crypto.hash("sha256", JSON.stringify(fieldConfig), "hex");
  return `${tenant}:${language}:${fingerprint}:${viewerRole || ""}`;
}

function blueprintMismatchError(
  submittedBlueprintId: unknown,
  currentVersion: string | number,
): ContactBlueprintValidationError {
  const message = `Blueprint version mismatch. Expected version ${currentVersion}, got ${submittedBlueprintId}. Please reload the form.`;
  return new ContactBlueprintValidationError(message, [
    { fieldId: "_blueprintId", tabId: "basic", message },
  ]);
}

function toBlueprintValidationError(
  error: z.ZodError,
  submitted: unknown,
  fields: FieldConfig["fields"],
  language: string,
): ContactBlueprintValidationError {
  const issues = formatZodIssues(error, submitted, fields, language);
  const message = issues.map((issue) => issue.message).join("; ") || "Invalid contact";
  return new ContactBlueprintValidationError(message, issues);
}

/**
 * Validates one or more contact records against the current tenant's dynamic field blueprint.
 *
 * Server authority for Setup: required tabs, per-field required/type rules, and the
 * optional blueprint-version lock (`_blueprintId`) are enforced here, not only in the form.
 *
 * @param tenant - The workspace subdomain/tenant.
 * @param contact - The contact record or array of contact records to validate.
 * @param languageOrOptions - Language code, or options carrying a preloaded field config.
 * @throws {ContactBlueprintValidationError} if validation fails.
 */
export async function validateContactDynamic(
  tenant: string,
  contact: unknown,
  languageOrOptions: string | ValidateContactDynamicOptions = "en",
  viewerRoleArg?: string,
): Promise<void> {
  const options: ValidateContactDynamicOptions =
    typeof languageOrOptions === "string"
      ? { language: languageOrOptions, viewerRole: viewerRoleArg }
      : languageOrOptions;
  const language = options.language ?? "en";
  const viewerRole = options.viewerRole;
  const fieldConfig =
    options.fieldConfig !== undefined ? options.fieldConfig : await loadContactFieldConfig();
  if (!fieldConfig) {
    return; // No config, nothing to validate.
  }

  // Version Lock check (Rule 16.3 / CS-6)
  let submittedBlueprintId: unknown;
  if (contact && typeof contact === "object" && !Array.isArray(contact)) {
    submittedBlueprintId = (contact as Record<string, unknown>)._blueprintId;
  }
  try {
    verifyBlueprintVersion(submittedBlueprintId, fieldConfig.version);
  } catch {
    throw blueprintMismatchError(submittedBlueprintId, fieldConfig.version ?? 1);
  }

  const cacheKey = getBlueprintCacheKey(tenant, fieldConfig, language, viewerRole);
  let schema = schemaCache.get(cacheKey);

  if (!schema) {
    const enabledTabIds = resolveContactEnabledTabIds(fieldConfig, viewerRole || "");
    const requiredTabIds = new Set(fieldConfig.requiredTabs || []);
    const fields = fieldConfig.fields || {};

    schema = buildDynamicContactSchema(
      fieldConfig,
      enabledTabIds,
      requiredTabIds,
      fields,
      language,
      viewerRole,
    );
    if (schemaCache.size >= SCHEMA_CACHE_MAX_ENTRIES) {
      const firstKey = schemaCache.keys().next().value;
      if (firstKey) schemaCache.delete(firstKey);
    }
    schemaCache.set(cacheKey, schema);
  }

  const records = Array.isArray(contact) ? contact : [contact];
  for (const record of records) {
    const parsed = schema.safeParse(record);
    if (!parsed.success) {
      throw toBlueprintValidationError(parsed.error, record, fieldConfig.fields || {}, language);
    }
  }
}
