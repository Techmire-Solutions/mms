import type { AccountingFxRepository } from "./accountingFxRepository.js";
import {
  findFxRoundingAccountId,
  getCurrencySettings,
  saveCurrencySettings,
} from "../../db/repositories/accountingCurrencySettingsRepository.js";
import {
  findExchangeRatesByKeys,
  listExchangeRates,
  lookupExchangeRate,
  upsertExchangeRates,
} from "../../db/repositories/accountingExchangeRatesRepository.js";
import {
  listCurrencyExchangeability,
  saveCurrencyExchangeability,
} from "../../db/repositories/accountingCurrencyExchangeabilityRepository.js";

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
