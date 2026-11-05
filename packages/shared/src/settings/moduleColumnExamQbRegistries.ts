import {
  createColumnRegistry,
  type ModuleColumnKind,
  type ModuleColumnRegistryEntry,
} from "./moduleColumnCore.js";

export interface ExaminationExamWorkColumnLabels {
  name: string;
  subject: string;
  date: string;
  duration: string;
  status: string;
  totalMarks: string;
  passingMarks: string;
  classes: string;
  description: string;
}

const EXAMINATION_EXAM_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  name: "title",
  subject: "shortText",
  date: "date",
  duration: "number",
  status: "status",
  totalMarks: "number",
  passingMarks: "number",
  classes: "chips",
  description: "longText",
};

/** Builds tenant-default Work column registry for Examinations exam directory (list view). */
export function buildExaminationExamWorkColumnRegistry(
  labels: ExaminationExamWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    [
      "name",
      "subject",
      "date",
      "duration",
      "status",
      "totalMarks",
      "passingMarks",
      "classes",
      "description",
    ],
    labels,
    true,
    EXAMINATION_EXAM_COLUMN_KINDS,
  );
}

export interface ExaminationResultsWorkColumnLabels {
  rank: string;
  student: string;
  classRoll: string;
  marks: string;
  percentage: string;
  grade: string;
  passFail: string;
}

const EXAMINATION_RESULTS_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  rank: "code",
  student: "person",
  classRoll: "reference",
  marks: "number",
  percentage: "number",
  grade: "status",
  passFail: "status",
};

/** Builds tenant-default Work column registry for Examinations results rankings. */
export function buildExaminationResultsWorkColumnRegistry(
  labels: ExaminationResultsWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["rank", "student", "classRoll", "marks", "percentage", "grade", "passFail"],
    labels,
    true,
    EXAMINATION_RESULTS_COLUMN_KINDS,
  );
}

export interface QuestionBankWorkColumnLabels {
  text: string;
  category: string;
  language: string;
  type: string;
  difficulty: string;
  source: string;
}

const QUESTION_BANK_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  text: "longText",
  category: "shortText",
  language: "shortText",
  type: "status",
  difficulty: "status",
  source: "shortText",
};

/** Builds tenant-default Work column registry for Question Bank directory (list view). */
export function buildQuestionBankWorkColumnRegistry(
  labels: QuestionBankWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["text", "category", "language", "type", "difficulty", "source"],
    labels,
    true,
    QUESTION_BANK_COLUMN_KINDS,
  );
}
