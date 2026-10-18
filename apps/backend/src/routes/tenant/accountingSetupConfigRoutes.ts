import type { FastifyPluginAsync } from "fastify";
import {
  ACCOUNTING_MODULE_MANIFEST,
  accountingFieldConfigPutBodySchema,
  accountingPreferencesPutBodySchema,
  normalizeAccountingModulePreferences,
} from "@mms/shared";
import { registerModuleSetupConfigRoutes } from "../../lib/registerModuleSetupConfigRoutes.js";
import { canReadCollection } from "../../services/rbacService.js";
import {
  getAccountingFieldConfigService,
  updateAccountingFieldConfigService,
} from "../../services/accountingConfigService.js";
import {
  getAccountingPreferencesService,
  updateAccountingPreferencesService,
} from "../../services/accountingPreferencesService.js";
import { createCollectionAuditHelper } from "../../lib/createCollectionAuditHelper.js";

const auditAccounting = createCollectionAuditHelper("accounting_accounts");

/** Accounting Setup field-config + preferences (typed FORCE-RLS tables). */
export const accountingSetupConfigRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleSetupConfigRoutes(fastify, {
    canRead: (user) => canReadCollection(user, "accounting_accounts"),
    setupWritePermission: ACCOUNTING_MODULE_MANIFEST.permissions.setupWrite,

    fieldConfigSchema: accountingFieldConfigPutBodySchema,
    loadFieldConfig: getAccountingFieldConfigService,
    saveFieldConfig: (body) => updateAccountingFieldConfigService(body),

    preferencesSchema: accountingPreferencesPutBodySchema,
    loadPreferences: getAccountingPreferencesService,
    normalizePreferences: normalizeAccountingModulePreferences,
    savePreferences: (normalized) => updateAccountingPreferencesService(normalized),

    audit: auditAccounting,
    fieldConfigAuditAction: "UPDATE_ACCOUNTING_CONFIG",
    fieldConfigAuditSummary: "Updated accounting field configuration",
    preferencesAuditAction: "UPDATE_ACCOUNTING_PREFERENCES",
    preferencesAuditSummary: "Updated accounting module preferences",
    loadFieldConfigError: "Failed to load accounting field config",
    saveFieldConfigError: "Failed to save accounting field config",
    loadPreferencesError: "Failed to load accounting preferences",
    savePreferencesError: "Failed to save accounting preferences",
  });
};
