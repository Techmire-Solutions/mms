import { isQuestionAnswerCorrect, type QuestionType } from "@mms/shared";

/**
 * Server-side scoring for Question Bank assessment answers.
 *
 * Scoring used to live only in the browser (`AutoGradingResultRow`), and the API persisted whatever
 * `scores` a client sent — a 1-mark question could be scored 999. This module is the authority:
 * correctness comes from the question's own answer key, and the award is the question's marks,
 * clamped to that same value, so an inflated score is not representable.
 */

/** The part of a question scoring reads. */
export interface ScoreableQuestion {
  id: string;
  type: QuestionType;
  options: readonly string[];
  answer: string;
  marks?: number | null;
}

export interface AssessmentScore {
  scores: Record<string, number>;
  total: number;
}

function marksFor(question: ScoreableQuestion): number {
  const marks = question.marks ?? 1;
  return Number.isInteger(marks) && marks > 0 ? marks : 1;
}

/** Award for one answer: the question's full marks when correct, zero otherwise. */
export function scoreQuestionAnswer(
  question: ScoreableQuestion,
  studentAnswer: string | undefined,
): number {
  const correct = isQuestionAnswerCorrect(
    { type: question.type, answer: question.answer, options: [...question.options] },
    studentAnswer,
  );
  return correct ? marksFor(question) : 0;
}

/**
 * Score a whole paper.
 *
 * Unknown question ids in `answers` are ignored (a stale client cannot inject score rows) and every
 * question on the paper is scored, so the result cannot be inflated by omitting answers.
 */
export function scoreAssessment(
  questions: readonly ScoreableQuestion[],
  answers: Readonly<Record<string, string>>,
): AssessmentScore {
  const scores: Record<string, number> = {};
  let total = 0;
  for (const question of questions) {
    const score = scoreQuestionAnswer(question, answers[question.id]);
    scores[question.id] = score;
    total += score;
  }
  return { scores, total };
}
