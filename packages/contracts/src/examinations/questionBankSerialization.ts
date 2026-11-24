import { z } from "zod";
import { questionBankQuestionRecordSchema } from "./questionBankModuleManifest.js";
import { questionDifficultySchema, questionTypeSchema } from "./questionTaxonomy.js";
import type { QuestionBankQuestion } from "./questionBankEntities.js";

/**
 * Client serialization for Question Bank questions.
 *
 * The stored record carries the answer key in `answer` (the UI labels it "Explanation"). Only a
 * caller with the module's write action may see it; every other read (read-only roles, the paper
 * picker, exports) receives the summary shape. Keeping this in the shared package means the backend
 * serializer and the response schema cannot disagree.
 */

/** A question without its answer key. */
export const questionBankQuestionSummarySchema = questionBankQuestionRecordSchema.omit({
  answer: true,
});

/** Either shape a list response may carry (homogeneous per request, unioned for the wire). */
export const questionBankQuestionClientSchema = z.union([
  questionBankQuestionRecordSchema,
  questionBankQuestionSummarySchema,
]);

/** Immutable per-paper question snapshot written at publication (0241). */
export const questionBankQuestionSnapshotSchema = z
  .object({
    id: z.string(),
    type: questionTypeSchema,
    text: z.string(),
    answer: z.string(),
    marks: z.number().int().nonnegative(),
    difficulty: questionDifficultySchema,
    options: z.array(z.string()),
  })
  .strict();

export type QuestionSnapshot = z.infer<typeof questionBankQuestionSnapshotSchema>;

export type QuestionBankQuestionSummary = Omit<QuestionBankQuestion, "answer">;
export type QuestionBankQuestionClient = QuestionBankQuestion | QuestionBankQuestionSummary;

/** Strips the answer key unless the caller is allowed to see it. Pure; no I/O. */
export function serializeQuestionForClient<T extends QuestionBankQuestion>(
  question: T,
  options: { answerVisible: boolean },
): T | QuestionBankQuestionSummary {
  if (options.answerVisible) return question;
  const { answer: _answer, ...rest } = question;
  return rest as QuestionBankQuestionSummary;
}

/** Maps a whole list through {@link serializeQuestionForClient}. */
export function serializeQuestionsForClient(
  questions: readonly QuestionBankQuestion[],
  options: { answerVisible: boolean },
): QuestionBankQuestionClient[] {
  return questions.map((question) => serializeQuestionForClient(question, options));
}
