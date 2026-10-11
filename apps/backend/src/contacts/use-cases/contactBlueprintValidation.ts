import crypto from "node:crypto";
import type { z } from "zod";
import {
  buildDynamicContactSchema,
  resolveContactEnabledTabIds,
  verifyBlueprintVersion,
} from "@mms/shared";
import { loadContactFieldConfig } from "./contactConfigService.js";

// Cache compiled schemas by tenant, language, and active blueprint fingerprint (bounded to 100 entries).
const SCHEMA_CACHE_MAX_ENTRIES = 100;
const schemaCache = new Map<string, z.ZodTypeAny>();

function getBlueprintCacheKey(
  tenant: string,
  fieldConfig: unknown,
  language: string,
  viewerRole?: string,
): string {
  const fingerprint = crypto.hash("sha256", JSON.stringify(fieldConfig), "hex");
  return `${tenant}:${language}:${fingerprint}:${viewerRole || ""}`;
}

/**
 * Validates one or more contact records against the current tenant's dynamic field blueprint.
 *
 * @param tenant - The workspace subdomain/tenant.
 * @param contact - The contact record or array of contact records to validate.
 * @param language - Optional language code for error message translation.
 * @param viewerRole - Optional role of the current viewer.
 * @throws {Error} if validation fails.
 */
export async function validateContactDynamic(
  tenant: string,
  contact: unknown,
  language = "en",
  viewerRole?: string,
): Promise<void> {
  const fieldConfig = await loadContactFieldConfig();
  if (!fieldConfig) {
    return; // No config, nothing to validate.
  }

  // Version Lock check (Rule 16.3 / CS-6)
  let submittedBlueprintId: unknown;
  if (contact && typeof contact === "object" && !Array.isArray(contact)) {
    submittedBlueprintId = (contact as Record<string, unknown>)._blueprintId;
  }
  verifyBlueprintVersion(submittedBlueprintId, fieldConfig.version);

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

  const { validateOrThrow } = await import("../../lib/zodRequest.js");
  validateOrThrow(schema, contact);
}
