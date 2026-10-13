import type {
  QuestionBankQuestion,
  QuestionBankResult,
  QuestionBankTest,
  QuestionCategory,
} from "@mms/shared";

export function sumScores(scores: Record<string, number>): number {
  return Object.values(scores).reduce((sum, value) => sum + value, 0);
}

export function testTotalMarks(
  test: QuestionBankTest,
  questions: QuestionBankQuestion[] | Map<string, QuestionBankQuestion>,
): number {
  if (questions instanceof Map) {
    let sum = 0;
    for (const qid of test.questionIds) {
      const question = questions.get(qid);
      if (question) sum += question.marks ?? 0;
    }
    return sum;
  }
  return test.questionIds.reduce((sum, qid) => {
    const question = questions.find((item) => item.id === qid);
    return sum + (question?.marks ?? 0);
  }, 0);
}

export interface PerformanceAnalyticsProps {
  tests: QuestionBankTest[];
  results: QuestionBankResult[];
  questions: QuestionBankQuestion[];
  categories: QuestionCategory[];
}

export interface StudentStatItem {
  name: string;
  class: string;
  scores: number[];
  totalPts: number;
  maxPts: number;
  avg: number;
  overall: number;
}

export interface CategoryPerformance {
  name: string;
  icon: string;
  color: string;
  accuracy: number;
  correct: number;
  total: number;
}
