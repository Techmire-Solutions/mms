import { questionBankUseCases } from "../questionBank/use-cases/questionBankUseCases.js";

/**
 * Thin re-export of the question bank command-metrics use-case.
 *
 * Kept for backward compatibility with existing importers. New code should depend
 * on `questionBank/use-cases/questionBankUseCases.js` directly.
 */
export const loadQuestionBankCommandMetrics = questionBankUseCases.loadQuestionBankCommandMetrics;
