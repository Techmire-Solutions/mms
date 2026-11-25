import { relations } from "drizzle-orm";
import { workspaces } from "../platform.js";
import { students } from "../students.js";
import {
  exams,
  examClasses,
  examResults,
  questions,
  questionCategories,
  questionOptions,
  questionTags,
  questionCitations,
  tests,
  testQuestions,
  testSections,
  testSectionQuestions,
  assessmentResults,
  assessmentAnswers,
} from "../examinations.js";

export const examsRelations = relations(exams, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [exams.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  classes: many(examClasses),
  results: many(examResults),
}));

export const examClassesRelations = relations(examClasses, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [examClasses.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  exam: one(exams, {
    fields: [examClasses.workspaceSubdomain, examClasses.examId],
    references: [exams.workspaceSubdomain, exams.id],
  }),
}));

export const examResultsRelations = relations(examResults, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [examResults.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  exam: one(exams, {
    fields: [examResults.workspaceSubdomain, examResults.examId],
    references: [exams.workspaceSubdomain, exams.id],
  }),
  student: one(students, {
    fields: [examResults.workspaceSubdomain, examResults.studentId],
    references: [students.workspaceSubdomain, students.id],
  }),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [questions.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  categories: many(questionCategories),
  options: many(questionOptions),
  tags: many(questionTags),
  citations: many(questionCitations),
  testQuestions: many(testQuestions),
  testSectionQuestions: many(testSectionQuestions),
  assessmentAnswers: many(assessmentAnswers),
}));

export const questionCategoriesRelations = relations(questionCategories, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [questionCategories.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  question: one(questions, {
    fields: [questionCategories.workspaceSubdomain, questionCategories.questionId],
    references: [questions.workspaceSubdomain, questions.id],
  }),
}));

export const questionOptionsRelations = relations(questionOptions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [questionOptions.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  question: one(questions, {
    fields: [questionOptions.workspaceSubdomain, questionOptions.questionId],
    references: [questions.workspaceSubdomain, questions.id],
  }),
}));

export const questionTagsRelations = relations(questionTags, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [questionTags.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  question: one(questions, {
    fields: [questionTags.workspaceSubdomain, questionTags.questionId],
    references: [questions.workspaceSubdomain, questions.id],
  }),
}));

export const questionCitationsRelations = relations(questionCitations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [questionCitations.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  question: one(questions, {
    fields: [questionCitations.workspaceSubdomain, questionCitations.questionId],
    references: [questions.workspaceSubdomain, questions.id],
  }),
}));

export const testsRelations = relations(tests, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [tests.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  questions: many(testQuestions),
  sections: many(testSections),
  results: many(assessmentResults),
}));

export const testQuestionsRelations = relations(testQuestions, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [testQuestions.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  test: one(tests, {
    fields: [testQuestions.workspaceSubdomain, testQuestions.testId],
    references: [tests.workspaceSubdomain, tests.id],
  }),
  question: one(questions, {
    fields: [testQuestions.workspaceSubdomain, testQuestions.questionId],
    references: [questions.workspaceSubdomain, questions.id],
  }),
}));

export const testSectionsRelations = relations(testSections, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [testSections.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  test: one(tests, {
    fields: [testSections.workspaceSubdomain, testSections.testId],
    references: [tests.workspaceSubdomain, tests.id],
  }),
  sectionQuestions: many(testSectionQuestions),
}));

export const testSectionQuestionsRelations = relations(testSectionQuestions, ({ one }) => ({
  section: one(testSections, {
    fields: [testSectionQuestions.workspaceSubdomain, testSectionQuestions.sectionId],
    references: [testSections.workspaceSubdomain, testSections.id],
  }),
  question: one(questions, {
    fields: [testSectionQuestions.workspaceSubdomain, testSectionQuestions.questionId],
    references: [questions.workspaceSubdomain, questions.id],
  }),
}));

export const assessmentResultsRelations = relations(assessmentResults, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [assessmentResults.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  test: one(tests, {
    fields: [assessmentResults.workspaceSubdomain, assessmentResults.testId],
    references: [tests.workspaceSubdomain, tests.id],
  }),
  answers: many(assessmentAnswers),
}));

export const assessmentAnswersRelations = relations(assessmentAnswers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [assessmentAnswers.workspaceSubdomain],
    references: [workspaces.subdomain],
  }),
  result: one(assessmentResults, {
    fields: [assessmentAnswers.workspaceSubdomain, assessmentAnswers.resultId],
    references: [assessmentResults.workspaceSubdomain, assessmentResults.id],
  }),
  question: one(questions, {
    fields: [assessmentAnswers.workspaceSubdomain, assessmentAnswers.questionId],
    references: [questions.workspaceSubdomain, questions.id],
  }),
}));
