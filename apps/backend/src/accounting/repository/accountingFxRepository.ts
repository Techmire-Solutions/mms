import type {
  AccountingCurrencySettings,
  AccountingCurrencySettingsPut,
  ExchangeRateListQuery,
  ExchangeRateLookupQuery,
  ExchangeRateLookupResult,
  ExchangeRatePutItem,
  ExchangeRateRecord,
} from "@mms/shared";

/** Storage gateway for IAS 21 currency settings and exchange rates. */
export interface AccountingFxRepository {
  getCurrencySettings(tenant: string): Promise<AccountingCurrencySettings>;
  saveCurrencySettings(
    tenant: string,
    input: AccountingCurrencySettingsPut,
    userId: string | null,
  ): Promise<AccountingCurrencySettings>;
  listExchangeRates(tenant: string, query: ExchangeRateListQuery): Promise<ExchangeRateRecord[]>;
  upsertExchangeRates(
    tenant: string,
    items: readonly ExchangeRatePutItem[],
    userId: string | null,
  ): Promise<ExchangeRateRecord[]>;
  /** Latest rate on or before the date; null when none applies (never a silent 1). */
  lookupExchangeRate(
    tenant: string,
    query: ExchangeRateLookupQuery,
  ): Promise<ExchangeRateLookupResult | null>;
  findFxRoundingAccountId(tenant: string): Promise<string | null>;
}
