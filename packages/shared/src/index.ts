/**
 * @file index.ts
 * @description Root entry point for @mms/shared.
 * Exports domain models, validation schemas, module manifests, settings defaults,
 * and pure utility functions across frontend and backend applications.
 */

// ---------------------------------------------------------------------------
// 1. Core Auth & User Identity
// ---------------------------------------------------------------------------
export type { User } from "./tenantAuthTypes.js";

export * from "./zodCsp.js";
export * from "./auditTypes.js";
export * from "./auditStateDelta.js";
export * from "./auditResponses.js";
export * from "./rfc8785CanonicalJson.js";
export * from "./passwordStrengthUtils.js";
export * from "./permissions.js";
export * from "./profileSchemas.js";
export * from "./tenantAuthTypes.js";
export * from "./tenantStorage.js";
export * from "./tenantUtils.js";
export * from "./userTypes.js";
export * from "./workspaceTypes.js";

// ---------------------------------------------------------------------------
// 2. Platform & System Infrastructure
// ---------------------------------------------------------------------------
export * from "./apiSchemas.js";
export * from "./backgroundJobTypes.js";
export * from "./platformApiErrors.js";
export * from "./platformSchemas.js";
export * from "./platformSettingsTypes.js";
export * from "./platformSetupValidation.js";
export * from "./platformTypes.js";
export * from "./erdCatalog.js";
export * from "./serverPorts.js";
export * from "./schemas/uiState.dto.js";
export * from "./schemas/platformAi.dto.js";
export * from "./schemas/moduleImport.dto.js";

// ---------------------------------------------------------------------------
// 3. Global Settings, Theme & Branding
// ---------------------------------------------------------------------------
export * from "./appTranslations.js";
export * from "./backupCrypto.js";
export * from "./backupTypes.js";
export * from "./brandingChartPalette.js";
export * from "./brandingColorContrast.js";
// Named: the frontend's design-token contrast test enforces this bound and must not
// restate the number (three copies of it drifted together once already).
export { MAX_RESTING_TINT_BY_MODE } from "./brandingCssContrast.js";
export * from "./brandingColorUtils.js";
export * from "./brandingCornerStyle.js";
export * from "./brandingCssVariables.js";
export * from "./brandingTypes.js";
export * from "./chartPalettes.js";
export * from "./dashboardPreferencesTypes.js";
export * from "./dashboardPreferencesChartOptions.js";
export * from "./dashboardWidgetSchema.js";
export * from "./dashboardSeriesUtils.js";
export * from "./dateFormatUtils.js";
export * from "./emailIntegrationTypes.js";
export * from "./emailProviderRegistry.js";
export * from "./smsIntegrationTypes.js";
export * from "./smsProviderRegistry.js";
export * from "./globalSettingsTypes.js";
export * from "./globalSettingsUtils.js";
export * from "./sessionPolicy.js";
export * from "./imageOptimizationUtils.js";
export * from "./languageUtils.js";
export * from "./llmSettingsTypes.js";
export * from "./logoBrandColors.js";
export * from "./logoPaletteSampling.js";
export * from "./settingsDateFormatters.js";
export * from "./timezoneUtils.js";

// ---------------------------------------------------------------------------
// 4. Module Setup, Field Registry & Column Layout
// ---------------------------------------------------------------------------
export * from "./contactLinkPolicy.js";
export * from "./createFieldRemovalIssuesChecker.js";
export * from "./createFormCustomFieldHelpers.js";
export * from "./fieldUsage.js";
export * from "./linkedCollectionUtils.js";
export * from "./moduleColumnPreferences.js";
export * from "./moduleColumnRegistrySync.js";
export * from "./moduleCommandMetrics.js";
export * from "./moduleFieldConfigPutBodySchema.js";
export * from "./moduleFieldConfigUtils.js";
export * from "./moduleFieldSchema.js";
export * from "./moduleFieldSetupDefaults.js";
export * from "./moduleTierTabs.js";

// ---------------------------------------------------------------------------
// 5. Contacts Feature Module
// ---------------------------------------------------------------------------
export * from "./contactColumnAccess.js";
export * from "./contactColumnRegistrySync.js";
export * from "./contactDuplicateUtils.js";
export * from "./contactEnabledTabs.js";
export * from "./contactFieldAccess.js";
export * from "./contactFieldDependencies.js";
export * from "./contactFieldUsage.js";
export * from "./contactFormCustomFields.js";
export * from "./contactIdentityMatch.js";
export * from "./contactLookupTypes.js";
export * from "./contactProfileCompleteness.js";
export * from "./contactRelationshipRules.js";
export * from "./contactResponseSanitizer.js";
export * from "./contactSetupConfigTypes.js";
export * from "./contactSiblingDerivation.js";
export * from "./contactSoftDelete.js";
export {
  stripClientSoftDeleteFields,
  isEntityDeleted,
  filterActiveEntities,
  CLIENT_SOFT_DELETE_KEYS,
  CONTACT_CLIENT_SOFT_DELETE_KEYS,
} from "./contactSoftDelete.js";
export * from "./studentSoftDelete.js";
export * from "./facultySoftDelete.js";
export * from "./sessionSoftDelete.js";
export * from "./enrollmentSoftDelete.js";
export * from "./softDelete.js";
export * from "./contactSyncDiff.js";
export * from "./contactTypes.js";
export * from "./contactColumnFieldMapping.js";
export * from "./contactUtils.js";
export * from "./contactValidation.js";
export * from "./contactsDuplicatesQuery.js";
export * from "./contactsExportUtils.js";
export * from "./contactsListQuery.js";
export * from "./contactsMetricsUtils.js";
export * from "./contactsModuleManifest.js";
export * from "./contactsPreferencesTypes.js";
export * from "./contactsReportAnalytics.js";
export * from "./contactsReportFields.js";
export * from "./contactsSearchUtils.js";
export * from "./contactsWidgetAggregate.js";
export * from "./savedReportsSchemas.js";
export type {
  ContactsSavedReportShareScope,
  ContactsSavedReportViewer,
} from "./contactsSavedReportUtils.js";
export {
  canDeleteContactsSavedReport,
  canViewContactsSavedReport,
  validateContactsSavedReportDrillDown,
} from "./contactsSavedReportUtils.js";
export * from "./socialPlatformUtils.js";
export * from "./contactNestedSchemas.js";
export * from "./csvParserCore.js";
export * from "./contactsCsvParser.js";
export * from "./contactsCsvHeaderMap.js";
export * from "./contactsCsvRowParser.js";
export * from "./contactsTransferSchema.js";

// ---------------------------------------------------------------------------
// 6. Students Feature Module
// ---------------------------------------------------------------------------
export * from "./studentColumnRegistrySync.js";
export * from "./studentDirectoryColumns.js";
export * from "./studentFieldDependencies.js";
export * from "./studentFormCustomFields.js";
export * from "./studentGuardianFromContacts.js";
export * from "./studentLookupTypes.js";
export * from "./studentPreferencesNormalization.js";
export * from "./studentRegistrationUtils.js";
export * from "./studentSettingsUtils.js";
export * from "./studentSetupConfigTypes.js";
export * from "./studentTypes.js";
export * from "./studentUtils.js";
export * from "./schemas/students.dto.js";
export * from "./schemas/contacts.dto.js";
export * from "./schemas/auth.dto.js";
export * from "./schemas/common.dto.js";
export * from "./csvImportMapper.js";
export * from "./csvTemplateGenerator.js";
export * from "./schemas/csvExport.dto.js";
export * from "./schemas/csvImport.dto.js";
export * from "./schemas/contactsImport.dto.js";
export * from "./schemas/faculty.dto.js";
export * from "./schemas/finance.dto.js";
export * from "./schemas/sessions.dto.js";
export * from "./schemas/moduleColumnPreferences.dto.js";
export * from "./schemas/attendance.dto.js";
export * from "./schemas/users.dto.js";
export * from "./schemas/db.dto.js";
export * from "./schemas/enrollments.dto.js";
export * from "./schemas/email.dto.js";
export * from "./schemas/sms.dto.js";
export * from "./schemas/sanitize.js";
export * from "./schemas/hasanat.dto.js";
export * from "./schemas/examinations.dto.js";
export * from "./schemas/questionBank.dto.js";
export * from "./schemas/backgroundJob.dto.js";
export * from "./schemas/messaging.dto.js";
export * from "./schemas/api.dto.js";
export * from "./contracts/ai.contract.js";
export * from "./contracts/health.contract.js";
export * from "./contracts/moduleAccess.contract.js";
export * from "./contracts/students.contract.js";
export * from "./contracts/index.js";
export * from "./studentExportColumns.js";
export * from "./studentsExportUtils.js";
export * from "./studentsListQuery.js";
export * from "./studentsModuleManifest.js";
export * from "./studentsModuleSettings.js";
export * from "./studentsResponseSanitizer.js";
export * from "./studentsWidgetAggregate.js";
export {
  STUDENT_WRITE_SYSTEM_KEYS,
  buildDynamicStudentSchema,
  formatStudentZodIssues,
  collectStudentWriteExtraFieldKeys,
} from "./studentValidation.js";

// ---------------------------------------------------------------------------
// 7. Faculty Feature Module
// ---------------------------------------------------------------------------
export * from "./facultyTypes.js";
export * from "./facultyStatusTypes.js";
export * from "./facultyModuleManifest.js";
export {
  facultyListPageResponseSchema,
  facultyPreferencesResponseSchema,
} from "./contracts/faculty.contract.js";
export * from "./facultyDirectoryColumns.js";
export * from "./facultyLookupTypes.js";
export * from "./facultyColumnRegistrySync.js";
export * from "./facultyEnabledTabs.js";
export * from "./facultyFieldCellFormat.js";
export * from "./facultyFieldDependencies.js";
export * from "./facultyFormCustomFields.js";
export * from "./facultyRegistrationUtils.js";
export * from "./facultyResponseSanitizer.js";
export * from "./facultySetupConfigTypes.js";
export * from "./facultyUtils.js";
export * from "./facultyValidation.js";
export * from "./facultyExportColumns.js";
export * from "./facultyExportUtils.js";
export * from "./facultyCatalogCsv.js";
export * from "./facultyCsvParser.js";
export * from "./facultyDepartmentCsvParser.js";
export * from "./facultyDesignationCsvParser.js";
export * from "./schemas/facultyImport.dto.js";
export * from "./facultyListQuery.js";
export * from "./facultyModuleSettings.js";
export * from "./facultyWidgetAggregate.js";
export * from "./demoSeedFaculty.js";
export * from "./demoFaculty.js";
export { facultyCsvExportBodySchema } from "./schemas/csvExport.dto.js";
export * from "./facultyDepartmentTypes.js";
export * from "./facultyPerformanceRating.js";
export * from "./moduleFieldSetupFaculty.js";

// ---------------------------------------------------------------------------
// 8. Sessions & Enrollments Modules
// ---------------------------------------------------------------------------
export * from "./enrollmentSetupConfigTypes.js";
export * from "./enrollmentUtils.js";
export * from "./enrollmentsExportUtils.js";
export * from "./enrollmentsListQuery.js";
export * from "./enrollmentsModuleManifest.js";
export * from "./enrollmentsModuleSettings.js";
export * from "./enrollmentsReportAggregates.js";
export * from "./enrollmentsWidgetAggregate.js";
export * from "./sessionFormCustomFields.js";
export * from "./sessionLookupTypes.js";
export * from "./sessionSetupConfigTypes.js";
export * from "./sessionTypeI18n.js";
export * from "./sessionTypes.js";
export * from "./sessionUtils.js";
export * from "./sessionsExportUtils.js";
export * from "./sessionsListQuery.js";
export * from "./sessionsModuleManifest.js";
export * from "./sessionsModuleSettings.js";
export * from "./sessionsReportAggregates.js";
export * from "./sessionsWidgetAggregate.js";

// ---------------------------------------------------------------------------
// 9. Attendance, Finance, Accounting & Obligations
// ---------------------------------------------------------------------------
export * from "./accountingDefaultChart.js";
export * from "./accountingJournalReversal.js";
export * from "./accountingJournalTemplates.js";
export * from "./accountingLedgerInvariants.js";
export * from "./accountingLedgerOps.js";
export * from "./accountingVoucherNumbering.js";
export * from "./accountingLedgerPosting.js";
export * from "./accountingListQuery.js";
export * from "./accountingModuleManifest.js";
export * from "./accountingModuleSettings.js";
export * from "./accountingReportAggregates.js";
export * from "./accountingSetupConfigTypes.js";
export * from "./accountingSpecializedEntries.js";
export * from "./financialLedgerTypes.js";
export * from "./attendanceListQuery.js";
export * from "./attendanceLookupTypes.js";
export * from "./attendanceModuleManifest.js";
export * from "./attendanceModuleSettings.js";
export * from "./attendanceReportAggregates.js";
export * from "./attendanceSetupConfigTypes.js";
export * from "./financeBilling.js";
export * from "./financeInvoiceGeneration.js";
export * from "./financeCollect.js";
export * from "./financeListQuery.js";
export * from "./financeModuleManifest.js";
export * from "./financeModuleSettings.js";
export * from "./financeReportAggregates.js";
export * from "./financeSetupConfigTypes.js";
export * from "./facultyDesignationTypes.js";
export * from "./facultyEmployDesignationTypes.js";
export * from "./obligationsModuleManifest.js";
export * from "./obligationsReportAggregates.js";

// ---------------------------------------------------------------------------
// 10. Hasanat, Examinations & Question Bank
// ---------------------------------------------------------------------------
export * from "./examinationsListQuery.js";
export * from "./examinationsModuleManifest.js";
export * from "./examinationsModuleSettings.js";
export * from "./examinationsSetupConfigTypes.js";
export * from "./hasanatListQuery.js";
export * from "./hasanatModuleManifest.js";
export * from "./hasanatModuleSettings.js";
export * from "./hasanatPointsUtils.js";
export * from "./hasanatReportAggregates.js";
export * from "./hasanatSetupConfigTypes.js";
export * from "./questionBankAnswerUtils.js";
export * from "./questionBankCategoryUtils.js";
export * from "./questionBankCore.js";
export * from "./questionBankDefaults.js";
export * from "./questionBankEntities.js";
export * from "./questionBankFormUtils.js";
export * from "./questionBankListQuery.js";
export * from "./questionBankModuleManifest.js";
export * from "./questionBankModuleSettings.js";
export * from "./questionBankSetupConfigTypes.js";
export * from "./questionBankSourceUtils.js";
export * from "./questionBankReportAggregates.js";
export * from "./questionBankTypes.js";

// ---------------------------------------------------------------------------
// 11. Users & Messaging Modules
// ---------------------------------------------------------------------------
export * from "./dashboardModuleManifest.js";
export * from "./moduleAccessPolicy.js";
export * from "./messagingModuleManifest.js";
export * from "./messagingPersonalizeUtils.js";
export * from "./messagingSchemas.js";
export * from "./smsUtils.js";
export * from "./userEntityTypes.js";
export * from "./userRbacDefaults.js";
export * from "./userRbacModuleRegistry.js";
export * from "./userRbacPermissionNav.js";
export * from "./userRbacRegistry.js";
export * from "./userRoleUtils.js";
export * from "./userRolePrivilege.js";
export * from "./userSetupConfigTypes.js";
export * from "./usersExportUtils.js";
export * from "./usersListQuery.js";
export * from "./usersModuleManifest.js";
export * from "./usersModuleSettings.js";
export * from "./usersReportAggregates.js";
export * from "./whatsappProvider.js";

// ---------------------------------------------------------------------------
// 12. Cross-Cutting Utilities & Seed Builders
// ---------------------------------------------------------------------------
export * from "./dataTransfer/index.js";
export * from "./ageUtils.js";
export * from "./blueprintVersionUtils.js";
export * from "./contactSanitization.js";
export * from "./csvUtils.js";
export * from "./gradeUtils.js";
export * from "./identityFormatUtils.js";
export * from "./moneyFormatUtils.js";
export * from "./numberUtils.js";
export * from "./paginationUtils.js";
export * from "./phoneUtils.js";
export * from "./titleCaseUtils.js";
export * from "./vcardUtils.js";
export * from "./widgetFilterUtils.js";

export * from "./examinationsReportAggregates.js";
export * from "./reportComparisonQuery.js";
export * from "./widgetAggregateTypes.js";
export * from "./types/moduleManifest.js";
export * from "./documentTemplateTypes.js";
export * from "./isoDateSchema.js";
export * from "./monthKeySchema.js";
export * from "./billingPeriodSchema.js";
export * from "./sequenceNumberingTypes.js";
export * from "./sequenceNumberingAdapters.js";
export * from "./sequenceNumberingUtils.js";
export * from "./obligationsModuleSettings.js";
export * from "./obligationsReceiptNumberingUtils.js";
export * from "./tasksModuleManifest.js";
export * from "./clientEntityIdUtils.js";
export * from "./industryTypes.js";
export * from "./industryProfiles.js";
export * from "./searchPatternUtils.js";
