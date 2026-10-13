/**
 * @file index.ts
 * @description Root entry point for @mms/shared.
 * Exports domain models, validation schemas, module manifests, settings defaults,
 * and pure utility functions across frontend and backend applications.
 */

// ---------------------------------------------------------------------------
// 1. Core Auth & User Identity
// ---------------------------------------------------------------------------
export type { User } from "./auth/tenantAuthTypes.js";

export * from "./core/zodCsp.js";
export * from "./audit/auditTypes.js";
export * from "./audit/auditStateDelta.js";
export * from "./audit/auditResponses.js";
export * from "./core/rfc8785CanonicalJson.js";
export * from "./auth/passwordStrengthUtils.js";
export * from "./auth/permissions.js";
export * from "./schemas/profile.dto.js";
export * from "./auth/tenantAuthTypes.js";
export * from "./auth/tenantStorage.js";
export * from "./auth/tenantUtils.js";
export * from "./auth/userTypes.js";
export * from "./auth/workspaceTypes.js";

// ---------------------------------------------------------------------------
// 2. Platform & System Infrastructure
// ---------------------------------------------------------------------------
export * from "./core/apiSchemas.js";
export * from "./auth/backgroundJobTypes.js";
export * from "./auth/platformApiErrors.js";
export * from "./schemas/platform.dto.js";
export * from "./auth/platformSettingsTypes.js";
export * from "./auth/platformSetupValidation.js";
export * from "./auth/platformTypes.js";
export * from "./erd/erdCatalog.js";
export * from "./core/serverPorts.js";
export * from "./schemas/uiState.dto.js";
export * from "./schemas/platformAi.dto.js";
export * from "./schemas/moduleImport.dto.js";

// ---------------------------------------------------------------------------
// 3. Global Settings, Theme & Branding
// ---------------------------------------------------------------------------
export * from "./i18n/appTranslations.js";
export * from "./backup/backupCrypto.js";
export * from "./backup/backupTypes.js";
export * from "./branding/brandingChartPalette.js";
export * from "./branding/brandingColorContrast.js";
// Named: the frontend's design-token contrast test enforces this bound and must not
// restate the number (three copies of it drifted together once already).
export { MAX_RESTING_TINT_BY_MODE } from "./branding/brandingCssContrast.js";
export * from "./branding/brandingColorUtils.js";
export * from "./branding/brandingCornerStyle.js";
export * from "./branding/brandingCssVariables.js";
export * from "./branding/brandingTypes.js";
export * from "./branding/chartPalettes.js";
export * from "./dashboard/dashboardPreferencesTypes.js";
export * from "./dashboard/dashboardPreferencesChartOptions.js";
export * from "./dashboard/dashboardWidgetSchema.js";
export * from "./dashboard/dashboardSeriesUtils.js";
export * from "./core/dateFormatUtils.js";
export * from "./messaging/emailIntegrationTypes.js";
export * from "./messaging/emailProviderRegistry.js";
export * from "./messaging/smsIntegrationTypes.js";
export * from "./messaging/smsProviderRegistry.js";
export * from "./settings/globalSettingsTypes.js";
export * from "./settings/globalSettingsUtils.js";
export * from "./sessions/sessionPolicy.js";
export * from "./core/imageOptimizationUtils.js";
export * from "./core/languageUtils.js";
export * from "./auth/llmSettingsTypes.js";
export * from "./branding/logoBrandColors.js";
export * from "./branding/logoPaletteSampling.js";
export * from "./settings/settingsDateFormatters.js";
export * from "./core/timezoneUtils.js";

// ---------------------------------------------------------------------------
// 4. Module Setup, Field Registry & Column Layout
// ---------------------------------------------------------------------------
export * from "./contacts/contactLinkPolicy.js";
export * from "./core/createFieldRemovalIssuesChecker.js";
export * from "./core/createFormCustomFieldHelpers.js";
export * from "./core/fieldUsage.js";
export * from "./core/linkedCollectionUtils.js";
export * from "./settings/moduleColumnPreferences.js";
export * from "./settings/moduleColumnRegistrySync.js";
export * from "./settings/moduleCommandMetrics.js";
export * from "./schemas/moduleFieldConfig.dto.js";
export * from "./settings/moduleFieldConfigUtils.js";
export * from "./settings/moduleFieldSchema.js";
export * from "./settings/moduleFieldSetupDefaults.js";
export * from "./settings/moduleTierTabs.js";

// ---------------------------------------------------------------------------
// 5. Contacts Feature Module
// ---------------------------------------------------------------------------
export * from "./contacts/contactColumnAccess.js";
export * from "./contacts/contactColumnRegistrySync.js";
export * from "./contacts/contactDuplicateUtils.js";
export * from "./contacts/contactEnabledTabs.js";
export * from "./contacts/contactFieldAccess.js";
export * from "./contacts/contactFieldDependencies.js";
export * from "./contacts/contactFieldUsage.js";
export * from "./contacts/contactFormCustomFields.js";
export * from "./contacts/contactIdentityMatch.js";
export * from "./contacts/contactLookupTypes.js";
export * from "./contacts/contactProfileCompleteness.js";
export * from "./contacts/contactRelationshipRules.js";
export * from "./contacts/contactResponseSanitizer.js";
export * from "./contacts/contactSetupConfigTypes.js";
export * from "./contacts/contactSiblingDerivation.js";
export * from "./contacts/contactSoftDelete.js";
export {
  stripClientSoftDeleteFields,
  isEntityDeleted,
  filterActiveEntities,
  CLIENT_SOFT_DELETE_KEYS,
  CONTACT_CLIENT_SOFT_DELETE_KEYS,
} from "./contacts/contactSoftDelete.js";
export * from "./students/studentSoftDelete.js";
export * from "./faculty/facultySoftDelete.js";
export * from "./sessions/sessionSoftDelete.js";
export * from "./enrollments/enrollmentSoftDelete.js";
export * from "./core/softDelete.js";
export * from "./contacts/contactSyncDiff.js";
export * from "./contacts/contactTypes.js";
export * from "./contacts/contactColumnFieldMapping.js";
export * from "./contacts/contactUtils.js";
export * from "./contacts/contactValidation.js";
export * from "./contacts/contactsDuplicatesQuery.js";
export * from "./contacts/contactsExportUtils.js";
export * from "./contacts/contactsListQuery.js";
export * from "./contacts/contactsMetricsUtils.js";
export * from "./contacts/contactsModuleManifest.js";
export * from "./contacts/contactsPreferencesTypes.js";
export * from "./contacts/contactsReportAnalytics.js";
export * from "./contacts/contactsReportFields.js";
export * from "./contacts/contactsSearchUtils.js";
export * from "./contacts/contactsWidgetAggregate.js";
export * from "./reports/savedReportsSchemas.js";
export type {
  ContactsSavedReportShareScope,
  ContactsSavedReportViewer,
} from "./contacts/contactsSavedReportUtils.js";
export {
  canDeleteContactsSavedReport,
  canViewContactsSavedReport,
  validateContactsSavedReportDrillDown,
} from "./contacts/contactsSavedReportUtils.js";
export * from "./messaging/socialPlatformUtils.js";
export * from "./contacts/contactNestedSchemas.js";
export * from "./core/csvParserCore.js";
export * from "./contacts/contactsCsvParser.js";
export * from "./contacts/contactsCsvHeaderMap.js";
export * from "./contacts/contactsCsvRowParser.js";
export * from "./contacts/contactsTransferSchema.js";

// ---------------------------------------------------------------------------
// 6. Students Feature Module
// ---------------------------------------------------------------------------
export * from "./students/studentColumnRegistrySync.js";
export * from "./students/studentDirectoryColumns.js";
export * from "./students/studentFieldDependencies.js";
export * from "./students/studentFormCustomFields.js";
export * from "./students/studentGuardianFromContacts.js";
export * from "./students/studentLookupTypes.js";
export * from "./students/studentPreferencesNormalization.js";
export * from "./students/studentRegistrationUtils.js";
export * from "./students/studentSettingsUtils.js";
export * from "./students/studentSetupConfigTypes.js";
export * from "./students/studentTypes.js";
export * from "./students/studentUtils.js";
export * from "./schemas/students.dto.js";
export * from "./schemas/contacts.dto.js";
export * from "./schemas/auth.dto.js";
export * from "./schemas/common.dto.js";
export * from "./core/csvImportMapper.js";
export * from "./core/csvTemplateGenerator.js";
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
export * from "./students/studentExportColumns.js";
export * from "./students/studentsExportUtils.js";
export * from "./students/studentsListQuery.js";
export * from "./students/studentsModuleManifest.js";
export * from "./students/studentsModuleSettings.js";
export * from "./students/studentsResponseSanitizer.js";
export * from "./students/studentsWidgetAggregate.js";
export {
  STUDENT_WRITE_SYSTEM_KEYS,
  buildDynamicStudentSchema,
  formatStudentZodIssues,
  collectStudentWriteExtraFieldKeys,
} from "./students/studentValidation.js";

// ---------------------------------------------------------------------------
// 7. Faculty Feature Module
// ---------------------------------------------------------------------------
export * from "./faculty/facultyTypes.js";
export * from "./faculty/facultyStatusTypes.js";
export * from "./faculty/facultyModuleManifest.js";
export {
  facultyListPageResponseSchema,
  facultyPreferencesResponseSchema,
} from "./contracts/faculty.contract.js";
export * from "./faculty/facultyDirectoryColumns.js";
export * from "./faculty/facultyLookupTypes.js";
export * from "./faculty/facultyColumnRegistrySync.js";
export * from "./faculty/facultyEnabledTabs.js";
export * from "./faculty/facultyFieldCellFormat.js";
export * from "./faculty/facultyFieldDependencies.js";
export * from "./faculty/facultyFormCustomFields.js";
export * from "./faculty/facultyRegistrationUtils.js";
export * from "./faculty/facultyResponseSanitizer.js";
export * from "./faculty/facultySetupConfigTypes.js";
export * from "./faculty/facultyUtils.js";
export * from "./faculty/facultyValidation.js";
export * from "./faculty/facultyExportColumns.js";
export * from "./faculty/facultyExportUtils.js";
export * from "./faculty/facultyCatalogCsv.js";
export * from "./faculty/facultyCsvParser.js";
export * from "./faculty/facultyDepartmentCsvParser.js";
export * from "./faculty/facultyDesignationCsvParser.js";
export * from "./schemas/facultyImport.dto.js";
export * from "./faculty/facultyListQuery.js";
export * from "./faculty/facultyModuleSettings.js";
export * from "./faculty/facultyWidgetAggregate.js";
export * from "./demo/demoSeedFaculty.js";
export * from "./demo/demoFaculty.js";
export { facultyCsvExportBodySchema } from "./schemas/csvExport.dto.js";
export * from "./faculty/facultyDepartmentTypes.js";
export * from "./faculty/facultyPerformanceRating.js";
export * from "./settings/moduleFieldSetupFaculty.js";

// ---------------------------------------------------------------------------
// 8. Sessions & Enrollments Modules
// ---------------------------------------------------------------------------
export * from "./enrollments/enrollmentSetupConfigTypes.js";
export * from "./enrollments/enrollmentUtils.js";
export * from "./enrollments/enrollmentsExportUtils.js";
export * from "./enrollments/enrollmentsListQuery.js";
export * from "./enrollments/enrollmentsModuleManifest.js";
export * from "./enrollments/enrollmentsModuleSettings.js";
export * from "./enrollments/enrollmentsReportAggregates.js";
export * from "./enrollments/enrollmentsWidgetAggregate.js";
export * from "./sessions/sessionFormCustomFields.js";
export * from "./sessions/sessionLookupTypes.js";
export * from "./sessions/sessionSetupConfigTypes.js";
export * from "./sessions/sessionTypeI18n.js";
export * from "./sessions/sessionTypes.js";
export * from "./sessions/sessionUtils.js";
export * from "./sessions/sessionsExportUtils.js";
export * from "./sessions/sessionsListQuery.js";
export * from "./sessions/sessionsModuleManifest.js";
export * from "./sessions/sessionsModuleSettings.js";
export * from "./sessions/sessionsReportAggregates.js";
export * from "./sessions/sessionsWidgetAggregate.js";

// ---------------------------------------------------------------------------
// 9. Attendance, Finance, Accounting & Obligations
// ---------------------------------------------------------------------------
export * from "./finance/accountingDefaultChart.js";
export * from "./finance/accountingJournalReversal.js";
export * from "./finance/accountingJournalTemplates.js";
export * from "./finance/accountingLedgerInvariants.js";
export * from "./finance/accountingLedgerOps.js";
export * from "./finance/accountingVoucherNumbering.js";
export * from "./finance/accountingLedgerPosting.js";
export * from "./finance/accountingListQuery.js";
export * from "./finance/accountingModuleManifest.js";
export * from "./finance/accountingModuleSettings.js";
export * from "./finance/accountingReportAggregates.js";
export * from "./finance/accountingSetupConfigTypes.js";
export * from "./finance/accountingSpecializedEntries.js";
export * from "./finance/financialLedgerTypes.js";
export * from "./attendance/attendanceListQuery.js";
export * from "./attendance/attendanceLookupTypes.js";
export * from "./attendance/attendanceModuleManifest.js";
export * from "./attendance/attendanceModuleSettings.js";
export * from "./attendance/attendanceReportAggregates.js";
export * from "./attendance/attendanceSetupConfigTypes.js";
export * from "./finance/financeBilling.js";
export * from "./finance/financeInvoiceGeneration.js";
export * from "./finance/financeCollect.js";
export * from "./finance/financeListQuery.js";
export * from "./finance/financeModuleManifest.js";
export * from "./finance/financeModuleSettings.js";
export * from "./finance/financeReportAggregates.js";
export * from "./finance/financeSetupConfigTypes.js";
export * from "./faculty/facultyDesignationTypes.js";
export * from "./faculty/facultyEmployDesignationTypes.js";
export * from "./obligations/obligationsModuleManifest.js";
export * from "./obligations/obligationsReportAggregates.js";

// ---------------------------------------------------------------------------
// 10. Hasanat, Examinations & Question Bank
// ---------------------------------------------------------------------------
export * from "./examinations/examinationsListQuery.js";
export * from "./examinations/examinationsModuleManifest.js";
export * from "./examinations/examinationsModuleSettings.js";
export * from "./examinations/examinationsSetupConfigTypes.js";
export * from "./hasanat/hasanatListQuery.js";
export * from "./hasanat/hasanatModuleManifest.js";
export * from "./hasanat/hasanatModuleSettings.js";
export * from "./hasanat/hasanatPointsUtils.js";
export * from "./hasanat/hasanatReportAggregates.js";
export * from "./hasanat/hasanatSetupConfigTypes.js";
export * from "./examinations/questionBankAnswerUtils.js";
export * from "./examinations/questionBankCategoryUtils.js";
export * from "./examinations/questionBankCore.js";
export * from "./examinations/questionBankDefaults.js";
export * from "./examinations/questionBankEntities.js";
export * from "./examinations/questionBankFormUtils.js";
export * from "./examinations/questionBankListQuery.js";
export * from "./examinations/questionBankModuleManifest.js";
export * from "./examinations/questionBankModuleSettings.js";
export * from "./examinations/questionBankSetupConfigTypes.js";
export * from "./examinations/questionBankSourceUtils.js";
export * from "./examinations/questionBankReportAggregates.js";
export * from "./examinations/questionBankTypes.js";

// ---------------------------------------------------------------------------
// 11. Users & Messaging Modules
// ---------------------------------------------------------------------------
export * from "./dashboard/dashboardModuleManifest.js";
export * from "./settings/moduleAccessPolicy.js";
export * from "./messaging/messagingModuleManifest.js";
export * from "./messaging/messagingPersonalizeUtils.js";
export * from "./messaging/messagingSchemas.js";
export * from "./messaging/smsUtils.js";
export * from "./auth/userEntityTypes.js";
export * from "./auth/userRbacDefaults.js";
export * from "./auth/userRbacModuleRegistry.js";
export * from "./auth/userRbacPermissionNav.js";
export * from "./auth/userRbacRegistry.js";
export * from "./auth/userRoleUtils.js";
export * from "./auth/userRolePrivilege.js";
export * from "./auth/userSetupConfigTypes.js";
export * from "./auth/usersExportUtils.js";
export * from "./auth/usersListQuery.js";
export * from "./auth/usersModuleManifest.js";
export * from "./auth/usersModuleSettings.js";
export * from "./auth/usersReportAggregates.js";
export * from "./messaging/whatsappProvider.js";

// ---------------------------------------------------------------------------
// 12. Cross-Cutting Utilities & Seed Builders
// ---------------------------------------------------------------------------
export * from "./dataTransfer/index.js";
export * from "./core/ageUtils.js";
export * from "./core/blueprintVersionUtils.js";
export * from "./contacts/contactSanitization.js";
export * from "./core/csvUtils.js";
export * from "./examinations/gradeUtils.js";
export * from "./core/identityFormatUtils.js";
export * from "./finance/moneyFormatUtils.js";
export * from "./core/numberUtils.js";
export * from "./core/paginationUtils.js";
export * from "./core/phoneUtils.js";
export * from "./core/titleCaseUtils.js";
export * from "./core/vcardUtils.js";
export * from "./dashboard/widgetFilterUtils.js";

export * from "./examinations/examinationsReportAggregates.js";
export * from "./reports/reportComparisonQuery.js";
export * from "./dashboard/widgetAggregateTypes.js";
export * from "./core/moduleManifest.js";
export * from "./documents/documentTemplateTypes.js";
export * from "./core/isoDateSchema.js";
export * from "./core/monthKeySchema.js";
export * from "./core/billingPeriodSchema.js";
export * from "./core/sequenceNumberingTypes.js";
export * from "./core/sequenceNumberingAdapters.js";
export * from "./core/sequenceNumberingUtils.js";
export * from "./obligations/obligationsModuleSettings.js";
export * from "./obligations/obligationsReceiptNumberingUtils.js";
export * from "./obligations/tasksModuleManifest.js";
export * from "./core/clientEntityIdUtils.js";
export * from "./auth/industryTypes.js";
export * from "./auth/industryProfiles.js";
export * from "./core/searchPatternUtils.js";
