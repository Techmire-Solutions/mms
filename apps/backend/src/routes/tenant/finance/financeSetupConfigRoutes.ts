import type { FastifyPluginAsync } from "fastify";
import {
  FINANCE_MODULE_MANIFEST,
  financeFieldConfigPutBodySchema,
  financePreferencesPutBodySchema,
  normalizeFinanceModulePreferences,
} from "@mms/shared";
import { registerModuleSetupConfigRoutes } from "../../../lib/registerModuleSetupConfigRoutes.js";
import { canReadCollection } from "../../../services/rbacService.js";
import {
  loadFinanceFieldConfig,
  saveFinanceFieldConfig,
} from "../../../services/financeConfigService.js";
import {
  loadFinanceModulePreferences,
  saveFinanceModulePreferences,
} from "../../../services/financePreferencesService.js";
import { createCollectionAuditHelper } from "../../../lib/createCollectionAuditHelper.js";

const auditFinance = createCollectionAuditHelper("finance");

/** Finance Setup field-config + preferences (typed FORCE-RLS tables). */
export const financeSetupConfigRoutes: FastifyPluginAsync = async (fastify) => {
  registerModuleSetupConfigRoutes(fastify, {
    canRead: (user) => canReadCollection(user, FINANCE_MODULE_MANIFEST.collectionKey),
    setupWritePermission: FINANCE_MODULE_MANIFEST.permissions.setupWrite,
    fieldConfigSchema: financeFieldConfigPutBodySchema,
    preferencesSchema: financePreferencesPutBodySchema,
    loadFieldConfig: loadFinanceFieldConfig,
    saveFieldConfig: saveFinanceFieldConfig,
    loadPreferences: loadFinanceModulePreferences,
    normalizePreferences: normalizeFinanceModulePreferences,
    savePreferences: saveFinanceModulePreferences,
    audit: auditFinance,
    fieldConfigAuditAction: "finance.field-config",
    fieldConfigAuditSummary: "Updated finance field configuration",
    preferencesAuditAction: "finance.preferences",
    preferencesAuditSummary: "Updated finance module preferences",
    loadFieldConfigError: "Failed to load finance field config",
    saveFieldConfigError: "Failed to save finance field config",
    loadPreferencesError: "Failed to load finance preferences",
    savePreferencesError: "Failed to save finance preferences",
  });
};
