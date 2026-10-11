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
    importPath: "./repositories/obligationRepository.js",
    fnName: "replaceObligationTypesForWorkspace",
    snapshotFnName: "listObligationTypesByWorkspace",
  },
  mujtahids: {
    importPath: "./repositories/obligationRepository.js",
    fnName: "replaceMujtahidsForWorkspace",
    snapshotFnName: "listMujtahidsByWorkspace",
  },
  mujtahid_reps: {
    importPath: "./repositories/obligationRepository.js",
    fnName: "replaceMujtahidRepsForWorkspace",
    snapshotFnName: "listMujtahidRepsByWorkspace",
  },
  wakala_types: {
    importPath: "./repositories/obligationRepository.js",
    fnName: "replaceWakalaTypesForWorkspace",
    snapshotFnName: "listWakalaTypesByWorkspace",
  },
  obligation_distributions: {
    importPath: "./repositories/obligationRepository.js",
    fnName: "replaceObligationDistributionsForWorkspace",
    snapshotFnName: "listObligationDistributionsByWorkspace",
  },
  obligation_collections: {
    importPath: "./repositories/obligationRepository.js",
    fnName: "replaceObligationCollectionsForWorkspace",
    snapshotFnName: "listObligationCollectionsByWorkspace",
  },
  exams: {
    importPath: "./repositories/examinationRepository.js",
    fnName: "replaceExamsForWorkspace",
    snapshotFnName: "listExamsByWorkspace",
  },
  exam_results: {
    importPath: "./repositories/examinationRepository.js",
    fnName: "replaceExamResultsForWorkspace",
    snapshotFnName: "listExamResultsByWorkspace",
  },
  examinations_field_configs: {
    priority: 49,
    importPath: "./repositories/examinationFieldConfigRepository.js",
    fnName: "replaceExaminationFieldConfigsForWorkspace",
    snapshotFnName: "listAllExaminationFieldConfigsByWorkspace",
  },
  examinations_module_preferences: {
    priority: 50,
    importPath: "./repositories/examinationModulePreferencesRepository.js",
    fnName: "replaceExaminationModulePreferencesForWorkspace",
    snapshotFnName: "listAllExaminationModulePreferencesByWorkspace",
  },
  hasanat_denoms: {
    importPath: "./repositories/hasanatRepository.js",
    fnName: "replaceDenomsForWorkspace",
    snapshotFnName: "listDenomsByWorkspace",
  },
  hasanat_batches: {
    importPath: "./repositories/hasanatRepository.js",
    fnName: "replaceBatchesForWorkspace",
    snapshotFnName: "listBatchesByWorkspace",
  },
  hasanat_distributions: {
    importPath: "./repositories/hasanatRepository.js",
    fnName: "replaceDistributionsForWorkspace",
    snapshotFnName: "listDistributionsByWorkspace",
  },
  hasanat_redemptions: {
    importPath: "./repositories/hasanatRepository.js",
    fnName: "replaceRedemptionsForWorkspace",
    snapshotFnName: "listRedemptionsByWorkspace",
  },
  hasanat_field_configs: {
    priority: 39,
    importPath: "./repositories/hasanatFieldConfigRepository.js",
    fnName: "replaceHasanatFieldConfigsForWorkspace",
    snapshotFnName: "listAllHasanatFieldConfigsByWorkspace",
  },
  hasanat_module_preferences: {
    priority: 40,
    importPath: "./repositories/hasanatModulePreferencesRepository.js",
    fnName: "replaceHasanatModulePreferencesForWorkspace",
    snapshotFnName: "listAllHasanatModulePreferencesByWorkspace",
  },
  questions: {
    importPath: "./repositories/questionBankRepository.js",
    fnName: "replaceQuestionsForWorkspace",
    snapshotFnName: "listQuestionsByWorkspace",
  },
  tests: {
    importPath: "./repositories/questionBankRepository.js",
    fnName: "replaceTestsForWorkspace",
    snapshotFnName: "listTestsByWorkspace",
  },
  assessment_results: {
    importPath: "./repositories/questionBankRepository.js",
    fnName: "replaceResultsForWorkspace",
    snapshotFnName: "listResultsByWorkspace",
  },
  question_bank_field_configs: {
    priority: 51,
    importPath: "./repositories/questionBankFieldConfigRepository.js",
    fnName: "replaceQuestionBankFieldConfigsForWorkspace",
    snapshotFnName: "listAllQuestionBankFieldConfigsByWorkspace",
  },
  question_bank_module_preferences: {
    priority: 52,
    importPath: "./repositories/questionBankModulePreferencesRepository.js",
    fnName: "replaceQuestionBankModulePreferencesForWorkspace",
    snapshotFnName: "listAllQuestionBankModulePreferencesByWorkspace",
  },
};
