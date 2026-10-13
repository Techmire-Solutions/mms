import { type z } from "zod";
import {
  buildDynamicFacultySchema,
  resolveFacultyEnabledTabIds,
  resolveFacultyFieldsMapForColumnSync,
  type FieldDefinition,
} from "@mms/shared";
import { loadFacultySettingsCombined } from "../faculty/use-cases/facultyConfigService.js";
import { validateOrThrow } from "../lib/zodRequest.js";

/** Cache compiled schema by tenant + enabled-tabs/fields fingerprint + language. */
const schemaCache = new Map<string, z.ZodTypeAny>();
const SCHEMA_CACHE_MAX_ENTRIES = 100;

function facultyValidationCacheKey(
  tenant: string,
  enabledTabs: string[],
  fields: Record<string, FieldDefinition[]>,
  language: string,
): string {
  return `${tenant}:${enabledTabs.join(",")}:${JSON.stringify(fields)}:${language}`;
}

/**
 * Validates one faculty write payload against the tenant's dynamic Fields registry.
 * @throws {Error} when validation fails
 */
export async function validateFacultyDynamic(
  tenant: string,
  facultyRecord: unknown,
  language = "en",
): Promise<void> {
  const settings = await loadFacultySettingsCombined();
  const fields = resolveFacultyFieldsMapForColumnSync(settings.fields);
  const enabledTabIds = new Set(resolveFacultyEnabledTabIds(settings));
  const cacheKey = facultyValidationCacheKey(tenant, [...enabledTabIds], fields, language);

  let schema = schemaCache.get(cacheKey);
  if (!schema) {
    schema = buildDynamicFacultySchema(settings, enabledTabIds, fields, language);
    if (schemaCache.size >= SCHEMA_CACHE_MAX_ENTRIES) {
      const oldestKey = schemaCache.keys().next().value;
      if (oldestKey) schemaCache.delete(oldestKey);
    }
    schemaCache.set(cacheKey, schema);
  }

  validateOrThrow(schema, facultyRecord);
}
