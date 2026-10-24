import type { ErdDomain } from "./erdCatalogTypes.js";

/** Scheduled exams and marks (Drizzle `examinationExamTables.ts`). */
export const ERD_DOMAIN_EXAMINATIONS: ErdDomain = {
  id: "examinations",
  labelKey: "nav.examinations",
  tables: [
    {
      name: "exams",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "name", type: "varchar(150)", kind: "column" },
        { name: "total_marks", type: "integer", kind: "column" },
        { name: "status", type: "varchar(20)", kind: "column" },
      ],
    },
    {
      name: "exam_classes",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "exam_id", type: "text", kind: "pk" },
        { name: "class_id", type: "varchar(64)", kind: "pk" },
      ],
    },
    {
      name: "exam_results",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "exam_id", type: "text", kind: "fk" },
        { name: "student_id", type: "varchar(64)", kind: "fk" },
        { name: "marks_obtained", type: "integer", kind: "column" },
      ],
    },
    {
      name: "students",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "gr_number", type: "varchar(100)", kind: "column" },
      ],
    },
  ],
  relationships: [
    {
      fromTable: "exam_classes",
      fromColumn: "exam_id",
      toTable: "exams",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "exam_results",
      fromColumn: "exam_id",
      toTable: "exams",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "exam_results",
      fromColumn: "student_id",
      toTable: "students",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
  ],
};

/** Item bank, papers, and assessment attempts (Drizzle question-bank tables). */
export const ERD_DOMAIN_QUESTION_BANK: ErdDomain = {
  id: "questionBank",
  labelKey: "nav.questionBank",
  tables: [
    {
      name: "questions",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "type", type: "varchar(30)", kind: "column" },
        { name: "difficulty", type: "varchar(20)", kind: "column" },
        { name: "marks", type: "integer", kind: "column" },
      ],
    },
    {
      name: "question_options",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "question_id", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "option_text", type: "text", kind: "column" },
      ],
    },
    {
      name: "tests",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
      ],
    },
    {
      name: "test_questions",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "test_id", type: "text", kind: "fk" },
        { name: "question_id", type: "text", kind: "fk" },
      ],
    },
    {
      name: "assessment_results",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "test_id", type: "text", kind: "fk" },
      ],
    },
    {
      name: "assessment_answers",
      columns: [
        { name: "workspace_subdomain", type: "text", kind: "pk" },
        { name: "id", type: "text", kind: "pk" },
        { name: "result_id", type: "text", kind: "fk" },
        { name: "question_id", type: "text", kind: "fk" },
      ],
    },
  ],
  relationships: [
    {
      fromTable: "question_options",
      fromColumn: "question_id",
      toTable: "questions",
      toColumn: "id",
      cardinality: "N:1",
      onDelete: "cascade",
    },
    {
      fromTable: "test_questions",
      fromColumn: "test_id",
      toTable: "tests",
      toColumn: "id",
      cardinality: "N:1",
    },
    {
      fromTable: "test_questions",
      fromColumn: "question_id",
      toTable: "questions",
      toColumn: "id",
      cardinality: "N:1",
    },
    {
      fromTable: "assessment_results",
      fromColumn: "test_id",
      toTable: "tests",
      toColumn: "id",
      cardinality: "N:1",
    },
    {
      fromTable: "assessment_answers",
      fromColumn: "result_id",
      toTable: "assessment_results",
      toColumn: "id",
      cardinality: "N:1",
    },
    {
      fromTable: "assessment_answers",
      fromColumn: "question_id",
      toTable: "questions",
      toColumn: "id",
      cardinality: "N:1",
    },
  ],
};
