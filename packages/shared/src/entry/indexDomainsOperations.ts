/**
 * @file indexDomainsOperations.ts
 * @description Operations domain exports: Finance, Accounting, Attendance, Examinations, Hasanat, Users, Messaging.
 */

// ---------------------------------------------------------------------------
// 9. Attendance, Finance, Accounting & Obligations
// ---------------------------------------------------------------------------
export * from "../finance/accountingDefaultChart.js";
export * from "../finance/accountingFxAccounts.js";
export * from "../finance/accountingFxLines.js";
export * from "../finance/accountingFxSettings.js";
export * from "../finance/accountingFxExchangeability.js";
export * from "../finance/accountingFxRevaluation.js";
export * from "../finance/accountingHyperinflation.js";
export * from "../finance/accountingHyperinflationSchemas.js";
export * from "../finance/accountingHedgeSchemas.js";
export * from "../finance/accountingHedges.js";
export * from "../finance/consolidationTranslation.js";
export * from "../finance/consolidationGroups.js";
export * from "../finance/accountingJournalReversal.js";
export * from "../finance/accountingJournalTemplates.js";
export * from "../finance/accountingLedgerInvariants.js";
export * from "../finance/accountingLedgerOps.js";
export * from "../finance/accountingVoucherNumbering.js";
export * from "../finance/accountingLedgerPosting.js";
export * from "../finance/accountingListQuery.js";
export * from "../finance/accountingModuleManifest.js";
export * from "../finance/accountingModuleSettings.js";
export * from "../finance/accountingReportAggregates.js";
export * from "../finance/accountingSetupConfigTypes.js";
export * from "../finance/accountingSpecializedEntries.js";
export * from "../finance/financialLedgerTypes.js";
export * from "../attendance/attendanceListQuery.js";
export * from "../attendance/attendanceLookupTypes.js";
export * from "../attendance/attendanceModuleManifest.js";
export * from "../attendance/attendanceModuleSettings.js";
export * from "../attendance/attendanceReportAggregates.js";
export * from "../attendance/attendanceSetupConfigTypes.js";
export * from "../finance/financeBilling.js";
export * from "../finance/financeDocumentFx.js";
export * from "../finance/financeFxPosting.js";
export * from "../finance/financeInvoiceGeneration.js";
export * from "../finance/financeCollect.js";
export * from "../finance/financeListQuery.js";
export * from "../finance/financeModuleManifest.js";
export * from "../finance/financeModuleSettings.js";
export * from "../finance/financeReportAggregates.js";
export * from "../finance/financeSetupConfigTypes.js";
export * from "../faculty/facultyDesignationTypes.js";
export * from "../faculty/facultyEmployDesignationTypes.js";
export * from "../obligations/obligationsModuleManifest.js";
export * from "../obligations/obligationsReportAggregates.js";

// ---------------------------------------------------------------------------
// 10. Hasanat, Examinations & Question Bank
// ---------------------------------------------------------------------------
export * from "../examinations/examinationsListQuery.js";
export * from "../examinations/examinationsModuleManifest.js";
export * from "../examinations/examinationsModuleSettings.js";
export * from "../examinations/examinationsSetupConfigTypes.js";
export * from "../hasanat/hasanatListQuery.js";
export * from "../hasanat/hasanatModuleManifest.js";
export * from "../hasanat/hasanatModuleSettings.js";
export * from "../hasanat/hasanatPointsUtils.js";
export * from "../hasanat/hasanatReportAggregates.js";
export * from "../hasanat/hasanatSetupConfigTypes.js";
export * from "../workshops/workshopsModuleManifest.js";
export * from "../workshops/workshopsRecords.js";
export * from "../workshops/workshopDays.js";
export * from "../workshops/workshopCompletion.js";
export * from "../examinations/questionBankAnswerUtils.js";
export * from "../examinations/questionBankCategoryUtils.js";
export * from "../examinations/questionBankCore.js";
export * from "../examinations/questionBankDefaults.js";
export * from "../examinations/questionBankEntities.js";
export * from "../examinations/questionBankFormUtils.js";
export * from "../examinations/questionBankListQuery.js";
export * from "../examinations/questionBankModuleManifest.js";
export * from "../examinations/questionBankModuleSettings.js";
export * from "../examinations/questionBankSetupConfigTypes.js";
export * from "../examinations/questionBankSourceUtils.js";
export * from "../examinations/questionBankReportAggregates.js";
export * from "../examinations/questionBankTypes.js";

// ---------------------------------------------------------------------------
// 11. Users & Messaging Modules
// ---------------------------------------------------------------------------
export * from "../dashboard/dashboardModuleManifest.js";
export * from "../settings/moduleAccessPolicy.js";
export * from "../messaging/messagingModuleManifest.js";
export * from "../messaging/messagingPersonalizeUtils.js";
export * from "../messaging/messagingSchemas.js";
export * from "../messaging/smsUtils.js";
export * from "../auth/userEntityTypes.js";
export * from "../auth/userRbacDefaults.js";
export * from "../auth/userRbacModuleRegistry.js";
export * from "../auth/userRbacPermissionNav.js";
export * from "../auth/userRbacRegistry.js";
export * from "../auth/userRoleUtils.js";
export * from "../auth/userRolePrivilege.js";
export * from "../auth/userSetupConfigTypes.js";
export * from "../auth/usersExportUtils.js";
export * from "../auth/usersListQuery.js";
export * from "../auth/usersModuleManifest.js";
export * from "../auth/usersModuleSettings.js";
export * from "../auth/usersReportAggregates.js";
export * from "../messaging/whatsappProvider.js";
