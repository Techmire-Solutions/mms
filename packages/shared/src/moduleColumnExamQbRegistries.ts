import { createColumnRegistry, type ModuleColumnRegistryEntry } from "./moduleColumnCore.js";

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

/** Builds tenant-default Work column registry for Examinations results rankings. */
export function buildExaminationResultsWorkColumnRegistry(
  labels: ExaminationResultsWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["rank", "student", "classRoll", "marks", "percentage", "grade", "passFail"],
    labels,
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

/** Builds tenant-default Work column registry for Question Bank directory (list view). */
export function buildQuestionBankWorkColumnRegistry(
  labels: QuestionBankWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["text", "category", "language", "type", "difficulty", "source"],
    labels,
  );
}
