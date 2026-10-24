import type { AccountingFxRepository } from "./accountingFxRepository.js";
import {
  findFxRoundingAccountId,
  getCurrencySettings,
  saveCurrencySettings,
} from "../../db/repositories/accountingCurrencySettingsRepository.js";
import {
  listExchangeRates,
  lookupExchangeRate,
  upsertExchangeRates,
} from "../../db/repositories/accountingExchangeRatesRepository.js";

/** Drizzle-backed implementation of {@link AccountingFxRepository}. */
export const accountingFxRepository: AccountingFxRepository = {
  getCurrencySettings,
  saveCurrencySettings,
  listExchangeRates,
  upsertExchangeRates,
  lookupExchangeRate,
  findFxRoundingAccountId,
};
