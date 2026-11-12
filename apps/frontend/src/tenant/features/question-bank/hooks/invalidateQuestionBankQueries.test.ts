import { describe, expect, it } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateQuestionBankQueries } from "./invalidateQuestionBankQueries";
import {
  QUESTION_BANK_METRICS_QUERY_KEY,
  QUESTION_BANK_QUESTIONS_QUERY_KEY,
  QUESTION_BANK_REPORT_AGGREGATES_QUERY_KEY,
  QUESTION_BANK_RESULTS_QUERY_KEY,
  QUESTION_BANK_TESTS_QUERY_KEY,
} from "./questionBankQueryKeys";

describe("invalidateQuestionBankQueries", () => {
  it("invalidates lists, metrics and the coverage/report aggregates", () => {
    const seen: unknown[] = [];
    const client = {
      invalidateQueries: ({ queryKey }: { queryKey: unknown }) => {
        seen.push(queryKey);
      },
    } as unknown as QueryClient;

    invalidateQuestionBankQueries(client);

    expect(seen).toContainEqual(QUESTION_BANK_QUESTIONS_QUERY_KEY);
    expect(seen).toContainEqual(QUESTION_BANK_TESTS_QUERY_KEY);
    expect(seen).toContainEqual(QUESTION_BANK_RESULTS_QUERY_KEY);
    expect(seen).toContainEqual(QUESTION_BANK_METRICS_QUERY_KEY);
    expect(seen).toContainEqual(QUESTION_BANK_REPORT_AGGREGATES_QUERY_KEY);
  });
});
