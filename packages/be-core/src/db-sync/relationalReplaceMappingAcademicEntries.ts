import type { RelationalCollectionMapping } from "./relationalReplaceMappingTypes.js";

/** Academic / operational collections: attendance, enrollments, exams, hasanat, obligations, question bank. */
export const RELATIONAL_REPLACE_MAPPING_ACADEMIC: Record<string, RelationalCollectionMapping> = {
  attendance_lookups: {
    priority: 36,
    importPath: "./repositories/attendanceLookupsRepository.js",
    fnName: "replaceAttendanceLookupsForWorkspace",
    snapshotFnName: "listAllAttendanceLookupsByWorkspace",
  },
  attendance_field_configs: {
    priority: 36,
    importPath: "./repositories/attendanceFieldConfigRepository.js",
    fnName: "replaceAttendanceFieldConfigsForWorkspace",
    snapshotFnName: "listAllAttendanceFieldConfigsByWorkspace",
  },
  attendance_module_preferences: {
    priority: 36,
    importPath: "./repositories/attendanceModulePreferencesRepository.js",
    fnName: "replaceAttendanceModulePreferencesForWorkspace",
    snapshotFnName: "listAllAttendanceModulePreferencesByWorkspace",
  },
  attendance_records: {
    importPath: "./repositories/attendanceRepository.js",
    fnName: "replaceAttendanceRecordsForWorkspace",
    snapshotFnName: "listAttendanceRecordsByWorkspace",
  },
  enrollments: {
    importPath: "./repositories/enrollmentRepository.js",
    fnName: "replaceEnrollmentsForWorkspace",
    snapshotFnName: "listEnrollmentsByWorkspace",
  },
  enrollment_field_configs: {
    priority: 45,
    importPath: "./repositories/enrollmentFieldConfigRepository.js",
    fnName: "replaceEnrollmentFieldConfigsForWorkspace",
    snapshotFnName: "listAllEnrollmentFieldConfigsByWorkspace",
  },
  enrollment_module_preferences: {
    priority: 46,
    importPath: "./repositories/enrollmentModulePreferencesRepository.js",
    fnName: "replaceEnrollmentModulePreferencesForWorkspace",
    snapshotFnName: "listAllEnrollmentModulePreferencesByWorkspace",
  },
  obligation_types: {
    importPath: "@mms/mod-obligations/backend/repository",
    fnName: "replaceObligationTypesForWorkspace",
    snapshotFnName: "listObligationTypesByWorkspace",
  },
  mujtahids: {
    importPath: "@mms/mod-obligations/backend/repository",
    fnName: "replaceMujtahidsForWorkspace",
    snapshotFnName: "listMujtahidsByWorkspace",
  },
  mujtahid_reps: {
    importPath: "@mms/mod-obligations/backend/repository",
    fnName: "replaceMujtahidRepsForWorkspace",
    snapshotFnName: "listMujtahidRepsByWorkspace",
  },
  wakala_types: {
    importPath: "@mms/mod-obligations/backend/repository",
    fnName: "replaceWakalaTypesForWorkspace",
    snapshotFnName: "listWakalaTypesByWorkspace",
  },
  obligation_distributions: {
    importPath: "@mms/mod-obligations/backend/repository",
    fnName: "replaceObligationDistributionsForWorkspace",
    snapshotFnName: "listObligationDistributionsByWorkspace",
  },
  obligation_collections: {
    importPath: "@mms/mod-obligations/backend/repository",
    fnName: "replaceObligationCollectionsForWorkspace",
    snapshotFnName: "listObligationCollectionsByWorkspace",
  },
  exams: {
    importPath: "@mms/mod-examinations/backend/repository",
    fnName: "replaceExamsForWorkspace",
    snapshotFnName: "listExamsByWorkspace",
  },
  exam_results: {
    importPath: "@mms/mod-examinations/backend/repository",
    fnName: "replaceExamResultsForWorkspace",
    snapshotFnName: "listExamResultsByWorkspace",
  },
  examinations_field_configs: {
    priority: 49,
    importPath: "@mms/mod-examinations/backend/repository",
    fnName: "replaceExaminationFieldConfigsForWorkspace",
    snapshotFnName: "listAllExaminationFieldConfigsByWorkspace",
  },
  examinations_module_preferences: {
    priority: 50,
    importPath: "@mms/mod-examinations/backend/repository",
    fnName: "replaceExaminationModulePreferencesForWorkspace",
    snapshotFnName: "listAllExaminationModulePreferencesByWorkspace",
  },
  hasanat_denoms: {
    importPath: "@mms/mod-hasanat/backend/repository",
    fnName: "replaceDenomsForWorkspace",
    snapshotFnName: "listDenomsByWorkspace",
  },
  hasanat_batches: {
    importPath: "@mms/mod-hasanat/backend/repository",
    fnName: "replaceBatchesForWorkspace",
    snapshotFnName: "listBatchesByWorkspace",
  },
  hasanat_distributions: {
    importPath: "@mms/mod-hasanat/backend/repository",
    fnName: "replaceDistributionsForWorkspace",
    snapshotFnName: "listDistributionsByWorkspace",
  },
  hasanat_redemptions: {
    importPath: "@mms/mod-hasanat/backend/repository",
    fnName: "replaceRedemptionsForWorkspace",
    snapshotFnName: "listRedemptionsByWorkspace",
  },
  hasanat_field_configs: {
    priority: 39,
    importPath: "@mms/mod-hasanat/backend/repository",
    fnName: "replaceHasanatFieldConfigsForWorkspace",
    snapshotFnName: "listAllHasanatFieldConfigsByWorkspace",
  },
  hasanat_module_preferences: {
    priority: 40,
    importPath: "@mms/mod-hasanat/backend/repository",
    fnName: "replaceHasanatModulePreferencesForWorkspace",
    snapshotFnName: "listAllHasanatModulePreferencesByWorkspace",
  },
  questions: {
    importPath: "@mms/mod-question-bank/backend/repository",
    fnName: "replaceQuestionsForWorkspace",
    snapshotFnName: "listQuestionsByWorkspace",
  },
  tests: {
    importPath: "@mms/mod-question-bank/backend/repository",
    fnName: "replaceTestsForWorkspace",
    snapshotFnName: "listTestsByWorkspace",
  },
  assessment_results: {
    importPath: "@mms/mod-question-bank/backend/repository",
    fnName: "replaceResultsForWorkspace",
    snapshotFnName: "listResultsByWorkspace",
  },
  question_bank_field_configs: {
    priority: 51,
    importPath: "@mms/mod-question-bank/backend/repository",
    fnName: "replaceQuestionBankFieldConfigsForWorkspace",
    snapshotFnName: "listAllQuestionBankFieldConfigsByWorkspace",
  },
  question_bank_module_preferences: {
    priority: 52,
    importPath: "@mms/mod-question-bank/backend/repository",
    fnName: "replaceQuestionBankModulePreferencesForWorkspace",
    snapshotFnName: "listAllQuestionBankModulePreferencesByWorkspace",
  },
};
