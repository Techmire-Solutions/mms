/**
 * @file indexCore.ts
 * @description Core infrastructure, platform, branding, settings, and shared utilities.
 */

// ---------------------------------------------------------------------------
// 1. Core Auth & User Identity
// ---------------------------------------------------------------------------
export type { User } from "../auth/tenantAuthTypes.js";

export * from "../core/zodCsp.js";
export * from "../audit/auditTypes.js";
export * from "../audit/auditStateDelta.js";
export * from "../audit/auditResponses.js";
export * from "../core/rfc8785CanonicalJson.js";
export * from "../auth/passwordStrengthUtils.js";
export * from "../auth/permissions.js";
export * from "../schemas/profile.dto.js";
export * from "../auth/tenantAuthTypes.js";
export * from "../auth/tenantStorage.js";
export * from "../auth/tenantUtils.js";
export * from "../auth/userTypes.js";
export * from "../auth/workspaceTypes.js";

// ---------------------------------------------------------------------------
// 2. Platform & System Infrastructure
// ---------------------------------------------------------------------------
export * from "../core/apiSchemas.js";
export * from "../auth/backgroundJobTypes.js";
export * from "../auth/platformApiErrors.js";
export * from "../schemas/platform.dto.js";
export * from "../auth/platformSettingsTypes.js";
export * from "../auth/platformSetupValidation.js";
export * from "../auth/platformTypes.js";
export * from "../erd/erdCatalog.js";
export * from "../core/serverPorts.js";
export * from "../schemas/uiState.dto.js";
export * from "../schemas/platformAi.dto.js";
export * from "../schemas/moduleImport.dto.js";

// ---------------------------------------------------------------------------
// 3. Global Settings, Theme & Branding
// ---------------------------------------------------------------------------
export * from "../i18n/appTranslations.js";
export * from "../backup/backupCrypto.js";
export * from "../backup/backupTypes.js";
export * from "../branding/brandingChartPalette.js";
export * from "../branding/brandingColorContrast.js";
export { MAX_RESTING_TINT_BY_MODE } from "../branding/brandingCssContrast.js";
export * from "../branding/brandingColorUtils.js";
export * from "../branding/brandingCornerStyle.js";
export * from "../branding/brandingCssVariables.js";
export * from "../branding/brandingTypes.js";
export * from "../branding/chartPalettes.js";
export * from "../dashboard/dashboardPreferencesTypes.js";
export * from "../dashboard/dashboardPreferencesChartOptions.js";
export * from "../dashboard/dashboardWidgetSchema.js";
export * from "../dashboard/dashboardSeriesUtils.js";
export * from "../core/dateFormatUtils.js";
export * from "../messaging/emailIntegrationTypes.js";
export * from "../messaging/emailProviderRegistry.js";
export * from "../messaging/smsIntegrationTypes.js";
export * from "../messaging/smsProviderRegistry.js";
export * from "../messaging/whatsappIntegrationTypes.js";
export * from "../messaging/whatsappProviderRegistry.js";
export * from "../schemas/whatsapp.dto.js";
export * from "../settings/globalSettingsTypes.js";
export * from "../settings/globalSettingsUtils.js";
export * from "../sessions/sessionPolicy.js";
export * from "../core/imageOptimizationUtils.js";
export * from "../core/languageUtils.js";
export * from "../auth/llmSettingsTypes.js";
export * from "../branding/logoBrandColors.js";
export * from "../branding/logoPaletteSampling.js";
export * from "../settings/settingsDateFormatters.js";
export * from "../core/timezoneUtils.js";

// ---------------------------------------------------------------------------
// 4. Module Setup, Field Registry & Column Layout
// ---------------------------------------------------------------------------
export * from "../contacts/contactLinkPolicy.js";
export * from "../core/createFieldRemovalIssuesChecker.js";
export * from "../core/createFormCustomFieldHelpers.js";
export * from "../core/fieldUsage.js";
export * from "../core/linkedCollectionUtils.js";
export * from "../settings/moduleColumnPreferences.js";
export * from "../settings/moduleColumnRegistrySync.js";
export * from "../settings/moduleCommandMetrics.js";
export * from "../schemas/moduleFieldConfig.dto.js";
export * from "../settings/moduleFieldConfigUtils.js";
export * from "../settings/moduleFieldSchema.js";
export * from "../settings/moduleFieldSetupDefaults.js";
export * from "../settings/moduleTierTabs.js";

// ---------------------------------------------------------------------------
// 12. Cross-Cutting Utilities & Seed Builders
// ---------------------------------------------------------------------------
export * from "../dataTransfer/index.js";
export * from "../core/ageUtils.js";
export * from "../core/blueprintVersionUtils.js";
export * from "../contacts/contactSanitization.js";
export * from "../core/csvUtils.js";
export * from "../examinations/gradeUtils.js";
export * from "../core/identityFormatUtils.js";
export * from "../finance/moneyFormatUtils.js";
export * from "../core/numberUtils.js";
export * from "../core/paginationUtils.js";
export * from "../core/phoneUtils.js";
export * from "../core/titleCaseUtils.js";
export * from "../core/vcardUtils.js";
export * from "../dashboard/widgetFilterUtils.js";

export * from "../examinations/examinationsReportAggregates.js";
export * from "../reports/reportComparisonQuery.js";
export * from "../dashboard/widgetAggregateTypes.js";
export * from "../core/moduleManifest.js";
export * from "../documents/documentTemplateTypes.js";
export * from "../core/isoDateSchema.js";
export * from "../core/monthKeySchema.js";
export * from "../core/billingPeriodSchema.js";
export * from "../core/sequenceNumberingTypes.js";
export * from "../core/sequenceNumberingAdapters.js";
export * from "../core/sequenceNumberingUtils.js";
export * from "../obligations/obligationsModuleSettings.js";
export * from "../obligations/obligationsSetupConfigTypes.js";
export * from "../obligations/obligationsReceiptNumberingUtils.js";
export * from "../obligations/tasksModuleManifest.js";
export * from "../core/clientEntityIdUtils.js";
export * from "../auth/industryTypes.js";
export * from "../auth/industryProfiles.js";
export * from "../core/searchPatternUtils.js";
