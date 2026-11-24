import { getPostingRules } from "./accountingLedgerOpsRepository.js";
import { listFiscalYearsByWorkspace } from "./accountingFiscalYearsRepository.js";
import {
  findFxRevaluationRunByDate,
  findFxRevaluationRunId,
  hasFxRevaluationBetween,
  listForeignMonetaryBalances,
  listFxRevaluationRuns,
  listFxRevaluationRunsBetween,
  saveFxRevaluationRun,
} from "./accountingFxRevaluationRepository.js";
import { listRealizedFxByCurrency } from "./accountingFxReportRepository.js";

/** Drizzle-backed storage for IAS 21 period-end revaluation (ports & adapters seam). */
export const accountingFxRevaluationRepository = {
  listForeignMonetaryBalances,
  listFxRevaluationRuns,
  listFxRevaluationRunsBetween,
  findFxRevaluationRunId,
  findFxRevaluationRunByDate,
  hasFxRevaluationBetween,
  saveFxRevaluationRun,
  getPostingRules,
  listFiscalYearsByWorkspace,
  listRealizedFxByCurrency,
};
