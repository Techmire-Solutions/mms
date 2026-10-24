/**
 * @file indexDomainsAcademic.ts
 * @description Academic domain exports: Contacts, Students, Faculty, Sessions & Enrollments.
 */

// ---------------------------------------------------------------------------
// 5. Contacts Feature Module
// ---------------------------------------------------------------------------
export * from "../contacts/contactColumnAccess.js";
export * from "../contacts/contactColumnRegistrySync.js";
export * from "../contacts/contactDuplicateUtils.js";
export * from "../contacts/contactEnabledTabs.js";
export * from "../contacts/contactFieldAccess.js";
export * from "../contacts/contactFieldDependencies.js";
export * from "../contacts/contactFieldUsage.js";
export * from "../contacts/contactFormCustomFields.js";
export * from "../contacts/contactIdentityMatch.js";
export * from "../contacts/contactLookupTypes.js";
export * from "../contacts/contactProfileCompleteness.js";
export * from "../contacts/contactRelationshipRules.js";
export * from "../contacts/contactResponseSanitizer.js";
export * from "../contacts/contactSetupConfigTypes.js";
export * from "../contacts/contactSiblingDerivation.js";
export * from "../contacts/contactSoftDelete.js";
export {
  stripClientSoftDeleteFields,
  isEntityDeleted,
  filterActiveEntities,
  CLIENT_SOFT_DELETE_KEYS,
  CONTACT_CLIENT_SOFT_DELETE_KEYS,
} from "../contacts/contactSoftDelete.js";
export * from "../students/studentSoftDelete.js";
export * from "../faculty/facultySoftDelete.js";
export * from "../sessions/sessionSoftDelete.js";
export * from "../enrollments/enrollmentSoftDelete.js";
export * from "../core/softDelete.js";
export * from "../contacts/contactSyncDiff.js";
export * from "../contacts/contactTypes.js";
export * from "../contacts/contactColumnFieldMapping.js";
export * from "../contacts/contactUtils.js";
export * from "../contacts/contactValidation.js";
export * from "../contacts/contactsDuplicatesQuery.js";
export * from "../contacts/contactsExportUtils.js";
export * from "../contacts/contactsListQuery.js";
export * from "../contacts/contactsMetricsUtils.js";
export * from "../contacts/contactsModuleManifest.js";
export * from "../contacts/contactsPreferencesTypes.js";
export * from "../contacts/contactsReportAnalytics.js";
export * from "../contacts/contactsReportFields.js";
export * from "../contacts/contactsSearchUtils.js";
export * from "../contacts/contactsWidgetAggregate.js";
export * from "../reports/savedReportsSchemas.js";
export type {
  ContactsSavedReportShareScope,
  ContactsSavedReportViewer,
} from "../contacts/contactsSavedReportUtils.js";
export {
  canDeleteContactsSavedReport,
  canViewContactsSavedReport,
  validateContactsSavedReportDrillDown,
} from "../contacts/contactsSavedReportUtils.js";
export * from "../messaging/socialPlatformUtils.js";
export * from "../contacts/contactNestedSchemas.js";
export * from "../core/csvParserCore.js";
export * from "../contacts/contactsCsvParser.js";
export * from "../contacts/contactsCsvHeaderMap.js";
export * from "../contacts/contactsCsvRowParser.js";
export * from "../contacts/contactsTransferSchema.js";

// ---------------------------------------------------------------------------
// 6. Students Feature Module
// ---------------------------------------------------------------------------
export * from "../students/studentColumnRegistrySync.js";
export * from "../students/studentDirectoryColumns.js";
export * from "../students/studentFieldDependencies.js";
export * from "../students/studentFormCustomFields.js";
export * from "../students/studentGuardianFromContacts.js";
export * from "../students/studentLookupTypes.js";
export * from "../students/studentPreferencesNormalization.js";
export * from "../students/studentRegistrationUtils.js";
export * from "../students/studentSettingsUtils.js";
export * from "../students/studentSetupConfigTypes.js";
export * from "../students/studentTypes.js";
export * from "../students/studentUtils.js";
export * from "../schemas/students.dto.js";
export * from "../schemas/contacts.dto.js";
export * from "../schemas/auth.dto.js";
export * from "../schemas/common.dto.js";
export * from "../core/csvImportMapper.js";
export * from "../core/csvTemplateGenerator.js";
export * from "../schemas/csvExport.dto.js";
export * from "../schemas/csvImport.dto.js";
export * from "../schemas/contactsImport.dto.js";
export * from "../schemas/faculty.dto.js";
export * from "../schemas/finance.dto.js";
export * from "../schemas/sessions.dto.js";
export * from "../schemas/moduleColumnPreferences.dto.js";
export * from "../schemas/attendance.dto.js";
export * from "../schemas/users.dto.js";
export * from "../schemas/db.dto.js";
export * from "../schemas/enrollments.dto.js";
export * from "../schemas/email.dto.js";
export * from "../schemas/sms.dto.js";
export * from "../schemas/sanitize.js";
export * from "../schemas/hasanat.dto.js";
export * from "../schemas/examinations.dto.js";
export * from "../schemas/questionBank.dto.js";
export * from "../schemas/backgroundJob.dto.js";
export * from "../schemas/messaging.dto.js";
export * from "../schemas/api.dto.js";
export * from "../contracts/ai.contract.js";
export * from "../contracts/health.contract.js";
export * from "../contracts/moduleAccess.contract.js";
export * from "../contracts/students.contract.js";
export * from "../contracts/index.js";
export * from "../students/studentExportColumns.js";
export * from "../students/studentsExportUtils.js";
export * from "../students/studentsListQuery.js";
export * from "../students/studentsModuleManifest.js";
export * from "../students/studentsModuleSettings.js";
export * from "../students/studentsResponseSanitizer.js";
export * from "../students/studentsWidgetAggregate.js";
export {
  STUDENT_WRITE_SYSTEM_KEYS,
  buildDynamicStudentSchema,
  formatStudentZodIssues,
  collectStudentWriteExtraFieldKeys,
} from "../students/studentValidation.js";

// ---------------------------------------------------------------------------
// 7. Faculty Feature Module
// ---------------------------------------------------------------------------
export * from "../faculty/facultyTypes.js";
export * from "../faculty/facultyStatusTypes.js";
export * from "../faculty/facultyModuleManifest.js";
export {
  facultyListPageResponseSchema,
  facultyPreferencesResponseSchema,
} from "../contracts/faculty.contract.js";
export * from "../faculty/facultyDirectoryColumns.js";
export * from "../faculty/facultyLookupTypes.js";
export * from "../faculty/facultyColumnRegistrySync.js";
export * from "../faculty/facultyEnabledTabs.js";
export * from "../faculty/facultyFieldCellFormat.js";
export * from "../faculty/facultyFieldDependencies.js";
export * from "../faculty/facultyFormCustomFields.js";
export * from "../faculty/facultyRegistrationUtils.js";
export * from "../faculty/facultyResponseSanitizer.js";
export * from "../faculty/facultySetupConfigTypes.js";
export * from "../faculty/facultyUtils.js";
export * from "../faculty/facultyValidation.js";
export * from "../faculty/facultyExportColumns.js";
export * from "../faculty/facultyExportUtils.js";
export * from "../faculty/facultyCatalogCsv.js";
export * from "../faculty/facultyCsvParser.js";
export * from "../faculty/facultyDepartmentCsvParser.js";
export * from "../faculty/facultyDesignationCsvParser.js";
export * from "../schemas/facultyImport.dto.js";
export * from "../faculty/facultyListQuery.js";
export * from "../faculty/facultyModuleSettings.js";
export * from "../faculty/facultyWidgetAggregate.js";
export * from "../demo/demoSeedFaculty.js";
export * from "../demo/demoFaculty.js";
export { facultyCsvExportBodySchema } from "../schemas/csvExport.dto.js";
export * from "../faculty/facultyDepartmentTypes.js";
export * from "../faculty/facultyPerformanceRating.js";
export * from "../settings/moduleFieldSetupFaculty.js";

// ---------------------------------------------------------------------------
// 8. Sessions & Enrollments Modules
// ---------------------------------------------------------------------------
export * from "../enrollments/enrollmentSetupConfigTypes.js";
export * from "../enrollments/enrollmentUtils.js";
export * from "../enrollments/enrollmentsExportUtils.js";
export * from "../enrollments/enrollmentsListQuery.js";
export * from "../enrollments/enrollmentsModuleManifest.js";
export * from "../enrollments/enrollmentsModuleSettings.js";
export * from "../enrollments/enrollmentsReportAggregates.js";
export * from "../enrollments/enrollmentsWidgetAggregate.js";
export * from "../enrollments/enrollmentFees.js";
export * from "../enrollments/enrollmentEligibility.js";
export * from "../enrollments/registrationTypes.js";
export * from "../enrollments/enrollmentOperations.js";
export * from "../attendance/academicCalendarTypes.js";
export * from "../attendance/academicCalendar.js";
export * from "../attendance/hijriCalendar.js";
export * from "../attendance/attendanceCoverage.js";
export * from "../sessions/academicCatalogTypes.js";
export * from "../sessions/academicTerminology.js";
export * from "../sessions/sessionSectionTypes.js";
export * from "../sessions/sectionOperations.js";
export * from "../sessions/sessionLifecycleOps.js";
export * from "../sessions/sessionRollover.js";
export * from "../sessions/sessionRolloverBuild.js";
export * from "../sessions/sessionCompletion.js";
export * from "../sessions/sessionLifecycle.js";
export * from "../sessions/sessionFormCustomFields.js";
export * from "../sessions/sessionLookupTypes.js";
export * from "../sessions/sessionSetupConfigTypes.js";
export * from "../sessions/sessionTypeI18n.js";
export * from "../sessions/sessionTypes.js";
export * from "../sessions/sessionUtils.js";
export * from "../sessions/sessionsExportUtils.js";
export * from "../sessions/sessionsListQuery.js";
export * from "../sessions/sessionsModuleManifest.js";
export * from "../sessions/sessionsModuleSettings.js";
export * from "../sessions/sessionsReportAggregates.js";
export * from "../sessions/sessionsWidgetAggregate.js";
