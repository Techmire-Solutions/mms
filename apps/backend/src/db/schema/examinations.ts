/**
 * Examinations & Question Bank Module Database Schema.
 *
 * Decomposed into modular tables (≤300 lines each):
 * - `examinationExamTables.ts`: Core exams, exam classes, exam results.
 * - `examinationQuestionBankTables.ts`: Questions, question categories, options, tags, citations.
 * - `examinationTestTables.ts`: Tests, test questions, test sections, assessment results and answers.
 * - `examinationSetupTables.ts`: Examinations and question bank field configs and module preferences.
 * - `examinationSchemaTypes.ts`: Inferred Drizzle select and insert row types.
 */
export * from "./examinationExamTables.js";
export * from "./examinationQuestionBankTables.js";
export * from "./examinationTestTables.js";
export * from "./examinationSetupTables.js";
export * from "./examinationSchemaTypes.js";
