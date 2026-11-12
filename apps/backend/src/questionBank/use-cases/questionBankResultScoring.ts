import { dedupeTrimmedIds, type QuestionBankQuestion, type QuestionBankResult } from "@mms/shared";
import type { QuestionBankRepository } from "../repository/questionBankRepository.js";
import { scoreAssessment } from "../domain/questionScoring.js";

/**
 * Recompute assessment scores on the server from the paper's own answer keys.
 *
 * The client's `scores` are discarded: correctness is `isQuestionAnswerCorrect` over the stored
 * question, and the award is that question's marks, so an inflated score cannot be persisted.
 *
 * Lives outside `questionBankUseCases.ts` to keep that file inside the 300-line ceiling.
 */
export async function scoreResultsForTenant(
  repo: QuestionBankRepository,
  tenant: string,
  records: QuestionBankResult[],
): Promise<QuestionBankResult[]> {
  const testIds = dedupeTrimmedIds(records.map((record) => record.testId));
  const tests = await repo.findTestsByIds(tenant, testIds, { includeDeleted: true });
  const questionIds = dedupeTrimmedIds(tests.flatMap((test) => test.questionIds));
  const questions =
    questionIds.length > 0
      ? await repo.findQuestionsByIds(tenant, questionIds, { includeDeleted: true })
      : [];
  const questionsById = new Map(questions.map((question) => [question.id, question]));
  const questionIdsByTest = new Map(tests.map((test) => [test.id, test.questionIds]));

  return records.map((record) => {
    const paperQuestions = (questionIdsByTest.get(record.testId) ?? [])
      .map((id) => questionsById.get(id))
      .filter((question): question is QuestionBankQuestion => Boolean(question))
      .map((question) => ({
        id: question.id,
        type: question.type,
        options: question.options,
        answer: question.answer,
        marks: question.marks,
      }));
    const { scores } = scoreAssessment(paperQuestions, record.answers ?? {});
    return { ...record, scores };
  });
}
