import type { StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import type { QuestionBankQuestion as Question, QuestionBankTest } from "@mms/shared";

export function sumScores(scores: Record<string, number>): number {
  return Object.values(scores).reduce((sum, value) => sum + value, 0);
}

export function testTotalMarks(
  test: QuestionBankTest,
  questions: Question[] | Map<string, Question>,
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

export interface GradeResult {
  label: string;
  status: string;
}

export function grade(percentageScore: number): GradeResult {
  if (percentageScore >= 90) return { label: "A+", status: "excellent" };
  if (percentageScore >= 80) return { label: "A", status: "excellent" };
  if (percentageScore >= 70) return { label: "B", status: "good" };
  if (percentageScore >= 60) return { label: "C", status: "warning" };
  if (percentageScore >= 50) return { label: "D", status: "warning" };
  return { label: "F", status: "failed" };
}

export const GRADE_BADGE_CONFIG: Record<string, StatusBadgeConfigItem> = {
  excellent: { label: "", cls: "bg-success/10 text-success border-success/30" },
  good: { label: "", cls: "bg-primary/10 text-primary border-primary/30" },
  warning: { label: "", cls: "bg-warning/10 text-warning border-warning/30" },
  failed: { label: "", cls: "bg-destructive/10 text-destructive border-destructive/30" },
};

export interface StatsSummary {
  avg: number;
  highest: number;
  lowest: number;
}
