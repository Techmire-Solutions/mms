import { getPostingRules } from "../../db/repositories/accountingLedgerOpsRepository.js";
import { listFiscalYearsByWorkspace } from "../../db/repositories/accountingFiscalYearsRepository.js";
import {
  findFxRevaluationRunId,
  hasFxRevaluationBetween,
  listForeignMonetaryBalances,
  listFxRevaluationRuns,
  saveFxRevaluationRun,
} from "../../db/repositories/accountingFxRevaluationRepository.js";

/** Drizzle-backed storage for IAS 21 period-end revaluation (ports & adapters seam). */
export const accountingFxRevaluationRepository = {
  listForeignMonetaryBalances,
  listFxRevaluationRuns,
  findFxRevaluationRunId,
  hasFxRevaluationBetween,
  saveFxRevaluationRun,
  getPostingRules,
  listFiscalYearsByWorkspace,
};
