import type { QuestionBankQuestion, QuestionBankTest, QuestionBankResult } from "@mms/shared";

export const QUESTION_BANK_METADATA_FIELDS = {
  questions: {
    name: "Question Bank Questions",
    dbKey: "questions",
    defaultData: [] as QuestionBankQuestion[],
    fields: [
      { value: "type", label: "Question Type" },
      { value: "difficulty", label: "Difficulty" },
      { value: "questionLanguage", label: "Question Language" },
      { value: "marks", label: "Marks", isNumeric: true },
    ],
    numericFields: [{ value: "marks", label: "Marks" }],
  },
  tests: {
    name: "Generated Tests",
    dbKey: "tests",
    defaultData: [] as QuestionBankTest[],
    fields: [
      { value: "difficulty", label: "Difficulty" },
      { value: "categoryId", label: "Category" },
      { value: "duration", label: "Duration", isNumeric: true },
      { value: "createdAt", label: "Created Date" },
    ],
    numericFields: [{ value: "duration", label: "Duration" }],
  },
  assessment_results: {
    name: "Assessment Results",
    dbKey: "assessment_results",
    defaultData: [] as QuestionBankResult[],
    fields: [
      { value: "testId", label: "Test" },
      { value: "studentName", label: "Student Name" },
      { value: "studentId", label: "Student ID" },
      { value: "submittedAt", label: "Submitted Date" },
    ],
    numericFields: [],
  },
} as const;
