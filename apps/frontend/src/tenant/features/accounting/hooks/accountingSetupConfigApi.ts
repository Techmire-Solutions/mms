import { apiContract } from "@/lib/api";
import { createModuleSetupConfigApi } from "@/lib/query/createModuleSetupConfigApi";
import type { AccountingModulePreferences, AccountingSettings } from "@mms/shared";
import { normalizeAccountingModulePreferences, normalizeJournalTemplates } from "@mms/shared";

/**
 * Exactly the keys `accountingPreferencesPutBodySchema` accepts — the same set
 * the Preferences dirty check watches, so "the Save button lit up" and "the PUT
 * carries that change" can never drift apart.
 *
 * The composed `AccountingSettings` also carries field-config keys (`fields`,
 * `formTabs`, …) that live behind `PUT /api/accounting/field-config`; the
 * preferences schema is `.strict()`, so sending the whole settings object would
 * be rejected for unrecognised keys.
 */
export const ACCOUNTING_PREFERENCES_KEYS = [
  "currency",
  "currencySymbol",
  "dateFormat",
  "decimalSeparator",
  "decimalPlaces",
  "fyStartMonth",
  "accountCodeLength",
  "requireNarration",
  "allowEditPosted",
  "autoPostDrafts",
  "retainedEarningsAccount",
  "organizationName",
  "defaultViewLayout",
  "journalTemplates",
] as const;

/** Maps composed Accounting settings onto the strict preferences PUT body. */
export function toAccountingPreferencesPayload(
  settings: AccountingSettings,
): AccountingModulePreferences {
  return {
    currency: settings.currency,
    currencySymbol: settings.currencySymbol,
    dateFormat: settings.dateFormat,
    decimalSeparator: settings.decimalSeparator === "comma" ? "comma" : "period",
    decimalPlaces: settings.decimalPlaces,
    fyStartMonth: settings.fyStartMonth,
    accountCodeLength: settings.accountCodeLength,
    requireNarration: Boolean(settings.requireNarration),
    allowEditPosted: Boolean(settings.allowEditPosted),
    autoPostDrafts: Boolean(settings.autoPostDrafts),
    retainedEarningsAccount: settings.retainedEarningsAccount ?? "",
    ...(typeof settings.organizationName === "string"
      ? { organizationName: settings.organizationName }
      : {}),
    ...(typeof settings.defaultViewLayout === "string"
      ? { defaultViewLayout: settings.defaultViewLayout }
      : {}),
    // Drops blank/duplicate rows the Setup editor still shows a warning for.
    journalTemplates: normalizeJournalTemplates(settings.journalTemplates),
  };
}

const api = createModuleSetupConfigApi<AccountingModulePreferences>({
  fetchPreferencesFn: async (_signal) => {
    const res = await apiContract.accounting.getPreferences({ query: undefined, extraHeaders: {} });
    return (res.body as { preferences: AccountingModulePreferences }).preferences;
  },
  savePreferencesFn: async (prefs) => {
    const res = await apiContract.accounting.updatePreferences({ body: prefs });
    return (res.body as { preferences: AccountingModulePreferences }).preferences;
  },
  normalizePrefs: normalizeAccountingModulePreferences as (
    prefs: unknown,
  ) => AccountingModulePreferences,
});

export const setAccountingPreferencesMemory = api.setPreferencesMemory;
export const fetchAccountingPreferences = api.fetchPreferences;
export const saveAccountingPreferencesAsync = api.savePreferencesAsync;
export const getAccountingSettingsMemoryFallback = api.getSettingsMemoryFallback;
