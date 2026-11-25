import { findAccountsByIds } from "./accountingAccountsRepository.js";
import { getCurrencySettings } from "./accountingCurrencySettingsRepository.js";
import { listFiscalYearsByWorkspace } from "./accountingFiscalYearsRepository.js";
import {
  accountExists,
  findIas29RunByDate,
  findIas29RunId,
  getHyperinflationSettings,
  listIas29Runs,
  listMonthlyMovements,
  listPriceIndices,
  saveHyperinflationSettings,
  saveIas29Run,
  upsertPriceIndices,
} from "./accountingHyperinflationRepository.js";

/** Drizzle-backed storage for IAS 29 hyperinflation restatement (ports & adapters seam). */
export const accountingHyperinflationRepository = {
  getCurrencySettings,
  listFiscalYearsByWorkspace,
  accountExists,
  findAccountsByIds,
  getHyperinflationSettings,
  saveHyperinflationSettings,
  listPriceIndices,
  upsertPriceIndices,
  listMonthlyMovements,
  listIas29Runs: (tenant: string) => listIas29Runs(tenant),
  findIas29RunByDate,
  findIas29RunId,
  saveIas29Run,
};

export type AccountingHyperinflationStore = typeof accountingHyperinflationRepository;
