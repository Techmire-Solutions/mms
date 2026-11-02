import type { FastifyPluginAsync } from "fastify";
import {
  CONTACTS_MODULE_MANIFEST,
  contactFieldConfigPutBodySchema,
  contactPreferencesPutBodySchema,
  normalizeContactPreferences,
} from "@mms/shared";
import { registerModuleSetupConfigRoutes } from "../../../lib/registerModuleSetupConfigRoutes.js";
import { canReadContacts } from "../../../services/rbacService.js";
import {
  loadContactFieldConfig,
  saveContactFieldConfig,
} from "../../../contacts/use-cases/contactConfigService.js";
import {
  loadContactPreferences,
  saveContactPreferences,
} from "../../../contacts/use-cases/contactPreferencesService.js";
import { invalidateDuplicateScanCache } from "../../../contacts/use-cases/contactDuplicateScanUseCases.js";
import { auditContact } from "./contactRouteHelpers.js";

/**
 * Preferences feed the duplicate scan (`namePrefixesToIgnore`), so a saved
 * preference change must drop the cached pair list. Invalidation is best-effort:
 * the save already committed, and the scan's TTL bounds any missed delete.
 */
export async function saveContactPreferencesAndInvalidateDuplicates(
  preferences: Parameters<typeof saveContactPreferences>[0],
  onInvalidateError?: (error: unknown) => void,
): Promise<Awaited<ReturnType<typeof saveContactPreferences>>> {
  const saved = await saveContactPreferences(preferences);
  try {
    await invalidateDuplicateScanCache();
  } catch (error) {
    onInvalidateError?.(error);
  }
  return saved;
}

/** Contacts Setup field-config + preferences (typed FORCE-RLS tables). */
export const contactSetupConfigRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleSetupConfigRoutes(fastify, {
    canRead: canReadContacts,
    setupWritePermission: CONTACTS_MODULE_MANIFEST.permissions.setupWrite,
    fieldConfigSchema: contactFieldConfigPutBodySchema,
    preferencesSchema: contactPreferencesPutBodySchema,
    loadFieldConfig: loadContactFieldConfig,
    saveFieldConfig: (body) => saveContactFieldConfig(body),
    loadPreferences: loadContactPreferences,
    normalizePreferences: normalizeContactPreferences,
    savePreferences: (normalized) =>
      saveContactPreferencesAndInvalidateDuplicates(normalized, (error) =>
        fastify.log.warn({ err: error }, "Failed to invalidate duplicate scan cache"),
      ),
    audit: (user, action, summary, entityId) => auditContact(user, action, summary, entityId),
    fieldConfigAuditAction: "contact.field-config",
    fieldConfigAuditSummary: "Updated contact field configuration",
    preferencesAuditAction: "contact.preferences",
    preferencesAuditSummary: "Updated contact preferences",
    loadFieldConfigError: "Failed to load contact field config",
    saveFieldConfigError: "Failed to save contact field config",
    loadPreferencesError: "Failed to load contact preferences",
    savePreferencesError: "Failed to save contact preferences",
  });
};
