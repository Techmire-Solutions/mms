import { getCurrencySettings } from "../../db/repositories/accountingCurrencySettingsRepository.js";
import { listFiscalYearsByWorkspace } from "../../db/repositories/accountingFiscalYearsRepository.js";
import {
  accountExists,
  findIas29RunId,
  getHyperinflationSettings,
  listIas29Runs,
  listMonthlyMovements,
  listPriceIndices,
  saveHyperinflationSettings,
  saveIas29Run,
  upsertPriceIndices,
} from "../../db/repositories/accountingHyperinflationRepository.js";

/** Drizzle-backed storage for IAS 29 hyperinflation restatement (ports & adapters seam). */
export const accountingHyperinflationRepository = {
  getCurrencySettings,
  listFiscalYearsByWorkspace,
  accountExists,
  getHyperinflationSettings,
  saveHyperinflationSettings,
  listPriceIndices,
  upsertPriceIndices,
  listMonthlyMovements,
  listIas29Runs: (tenant: string) => listIas29Runs(tenant),
  findIas29RunId,
  saveIas29Run,
};

export type AccountingHyperinflationStore = typeof accountingHyperinflationRepository;
