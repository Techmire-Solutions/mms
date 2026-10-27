import { QUESTION_BANK_MODULE_MANIFEST } from "@mms/shared";

export const QUESTION_BANK_API = QUESTION_BANK_MODULE_MANIFEST.restBasePath;

export const QUESTION_BANK_METRICS_QUERY_KEY = [
  QUESTION_BANK_MODULE_MANIFEST.moduleId,
  "metrics",
] as const;

export const QUESTION_BANK_QUESTIONS_QUERY_KEY = [
  QUESTION_BANK_MODULE_MANIFEST.moduleId,
  "questions",
  "list",
] as const;

export const QUESTION_BANK_TESTS_QUERY_KEY = [
  QUESTION_BANK_MODULE_MANIFEST.moduleId,
  "tests",
  "list",
] as const;

export const QUESTION_BANK_RESULTS_QUERY_KEY = [
  QUESTION_BANK_MODULE_MANIFEST.moduleId,
  "results",
  "list",
] as const;

export const QUESTION_BANK_REPORT_AGGREGATES_QUERY_KEY = [
  QUESTION_BANK_MODULE_MANIFEST.moduleId,
  "reports",
  "aggregates",
] as const;
