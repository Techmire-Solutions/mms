import type {
  QuestionBankCommandMetricsSnapshot,
  QuestionBankQuestion,
  QuestionBankTest,
  QuestionBankResult,
  QuestionBankReportQuery,
} from "@mms/shared";
import { QUESTION_BANK_MODULE_MANIFEST } from "@mms/shared";
import { serverMetricsQueryOptions, useServerMetrics } from "@/hooks/useServerMetrics";
import { useAuth } from "@/lib/contexts/AuthContext";
import { tsrClient } from "@/lib/api";

export function questionBankCommandMetricsQueryOptions() {
  return serverMetricsQueryOptions<QuestionBankCommandMetricsSnapshot>({
    moduleId: QUESTION_BANK_MODULE_MANIFEST.moduleId,
    apiPath: QUESTION_BANK_MODULE_MANIFEST.restBasePath,
  });
}

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

export function useQuestionBankQuestions(options?: {
  enabled?: boolean;
  includeDeleted?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const includeDeleted = options?.includeDeleted ?? false;
  const enabled = options?.enabled ?? true;
  return tsrClient.questionBank.listQuestions.useQuery({
    queryKey: [...QUESTION_BANK_QUESTIONS_QUERY_KEY, { includeDeleted }],
    queryData: { query: { includeDeleted: includeDeleted ? "true" : undefined } },
    enabled: isAuthenticated && enabled,
    staleTime: 30_000,
  });
}

export function useQuestionBankQuestionsCollection(options?: {
  enabled?: boolean;
  includeDeleted?: boolean;
}): QuestionBankQuestion[] {
  const query = useQuestionBankQuestions(options);
  if (!query.data || query.data.status !== 200) return [];
  const body = query.data.body;
  if (Array.isArray(body)) return body as QuestionBankQuestion[];
  if (body && typeof body === "object" && "questions" in body && Array.isArray(body.questions)) {
    return body.questions as QuestionBankQuestion[];
  }
  return [];
}

export function useQuestionBankTests(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  return tsrClient.questionBank.listTests.useQuery({
    queryKey: QUESTION_BANK_TESTS_QUERY_KEY,
    enabled: isAuthenticated && enabled,
    staleTime: 30_000,
  });
}

export function useQuestionBankTestsCollection(options?: {
  enabled?: boolean;
}): QuestionBankTest[] {
  const query = useQuestionBankTests(options);
  if (!query.data || query.data.status !== 200) return [];
  const body = query.data.body;
  if (Array.isArray(body)) return body as QuestionBankTest[];
  if (body && typeof body === "object" && "tests" in body && Array.isArray(body.tests)) {
    return body.tests as QuestionBankTest[];
  }
  return [];
}

export function useQuestionBankResults(options?: { enabled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  return tsrClient.questionBank.listResults.useQuery({
    queryKey: QUESTION_BANK_RESULTS_QUERY_KEY,
    enabled: isAuthenticated && enabled,
    staleTime: 30_000,
  });
}

export function useQuestionBankResultsCollection(options?: {
  enabled?: boolean;
}): QuestionBankResult[] {
  const query = useQuestionBankResults(options);
  if (!query.data || query.data.status !== 200) return [];
  const body = query.data.body;
  if (Array.isArray(body)) return body as QuestionBankResult[];
  if (body && typeof body === "object" && "results" in body && Array.isArray(body.results)) {
    return body.results as QuestionBankResult[];
  }
  return [];
}

export { useQuestionBankMutations } from "./useQuestionBankMutations";

export function useQuestionBankMetrics(options?: { enabled?: boolean }) {
  return useServerMetrics<QuestionBankCommandMetricsSnapshot>({
    moduleId: QUESTION_BANK_MODULE_MANIFEST.moduleId,
    apiPath: QUESTION_BANK_MODULE_MANIFEST.restBasePath,
    enabled: options?.enabled,
  });
}

export const QUESTION_BANK_REPORT_AGGREGATES_QUERY_KEY = [
  QUESTION_BANK_MODULE_MANIFEST.moduleId,
  "reports",
  "aggregates",
] as const;

export function useQuestionBankReportAggregates(
  filters?: QuestionBankReportQuery,
  options?: { enabled?: boolean },
) {
  const { isAuthenticated } = useAuth();
  const enabled = options?.enabled ?? true;
  return tsrClient.questionBank.reportAggregates.useQuery({
    queryKey: [...QUESTION_BANK_REPORT_AGGREGATES_QUERY_KEY, filters ?? {}],
    queryData: { query: filters },
    enabled: isAuthenticated && enabled,
    staleTime: 5 * 60 * 1000,
  });
}
