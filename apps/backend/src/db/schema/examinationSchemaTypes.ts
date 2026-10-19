import {
  type exams,
  type examClasses,
  type examResults,
  type questions,
  type questionCategories,
  type questionOptions,
  type questionTags,
  type questionCitations,
  type tests,
  type testQuestions,
  type testSections,
  type testSectionQuestions,
  type assessmentResults,
  type assessmentAnswers,
} from "./examinations.js";
import {
  type examinationsFieldConfigs,
  type examinationsModulePreferences,
  type questionBankFieldConfigs,
  type questionBankModulePreferences,
} from "./examinationSetupTables.js";

export type ExamRow = typeof exams.$inferSelect;
export type InsertExamRow = typeof exams.$inferInsert;
export type ExamClassRow = typeof examClasses.$inferSelect;
export type InsertExamClassRow = typeof examClasses.$inferInsert;
export type ExamResultRow = typeof examResults.$inferSelect;
export type InsertExamResultRow = typeof examResults.$inferInsert;
export type QuestionRow = typeof questions.$inferSelect;
export type InsertQuestionRow = typeof questions.$inferInsert;
export type QuestionCategoryRow = typeof questionCategories.$inferSelect;
export type InsertQuestionCategoryRow = typeof questionCategories.$inferInsert;
export type QuestionOptionRow = typeof questionOptions.$inferSelect;
export type InsertQuestionOptionRow = typeof questionOptions.$inferInsert;
export type QuestionTagRow = typeof questionTags.$inferSelect;
export type InsertQuestionTagRow = typeof questionTags.$inferInsert;
export type QuestionCitationRow = typeof questionCitations.$inferSelect;
export type InsertQuestionCitationRow = typeof questionCitations.$inferInsert;
export type TestRow = typeof tests.$inferSelect;
export type InsertTestRow = typeof tests.$inferInsert;
export type TestQuestionRow = typeof testQuestions.$inferSelect;
export type InsertTestQuestionRow = typeof testQuestions.$inferInsert;
export type TestSectionRow = typeof testSections.$inferSelect;
export type InsertTestSectionRow = typeof testSections.$inferInsert;
export type TestSectionQuestionRow = typeof testSectionQuestions.$inferSelect;
export type InsertTestSectionQuestionRow = typeof testSectionQuestions.$inferInsert;
export type AssessmentResultRow = typeof assessmentResults.$inferSelect;
export type InsertAssessmentResultRow = typeof assessmentResults.$inferInsert;
export type AssessmentAnswerRow = typeof assessmentAnswers.$inferSelect;
export type InsertAssessmentAnswerRow = typeof assessmentAnswers.$inferInsert;
export type ExaminationsFieldConfigsRow = typeof examinationsFieldConfigs.$inferSelect;
export type InsertExaminationsFieldConfigsRow = typeof examinationsFieldConfigs.$inferInsert;
export type ExaminationsModulePreferencesRow = typeof examinationsModulePreferences.$inferSelect;
export type InsertExaminationsModulePreferencesRow =
  typeof examinationsModulePreferences.$inferInsert;
export type QuestionBankFieldConfigsRow = typeof questionBankFieldConfigs.$inferSelect;
export type InsertQuestionBankFieldConfigsRow = typeof questionBankFieldConfigs.$inferInsert;
export type QuestionBankModulePreferencesRow = typeof questionBankModulePreferences.$inferSelect;
export type InsertQuestionBankModulePreferencesRow =
  typeof questionBankModulePreferences.$inferInsert;
