import type { AccountingFxRepository } from "./accountingFxRepository.js";
import {
  findFxRoundingAccountId,
  getCurrencySettings,
  saveCurrencySettings,
} from "./accountingCurrencySettingsRepository.js";
import {
  findExchangeRatesByKeys,
  listExchangeRates,
  lookupExchangeRate,
  upsertExchangeRates,
} from "./accountingExchangeRatesRepository.js";
import {
  listCurrencyExchangeability,
  saveCurrencyExchangeability,
} from "./accountingCurrencyExchangeabilityRepository.js";

/** Drizzle-backed implementation of {@link AccountingFxRepository}. */
export const accountingFxRepository: AccountingFxRepository = {
  getCurrencySettings,
  saveCurrencySettings,
  listExchangeRates,
  findExchangeRatesByKeys,
  upsertExchangeRates,
  lookupExchangeRate,
  findFxRoundingAccountId,
  listExchangeability: listCurrencyExchangeability,
  saveExchangeability: saveCurrencyExchangeability,
};
