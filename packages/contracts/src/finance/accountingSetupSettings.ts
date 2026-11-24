/** Accounting settings composition: field-config schema, normalize/compose/strip, tab merge. */
import { z } from "zod";
import type { TabDefinition } from "../contacts/contactTypes.js";
import {
  DEFAULT_ACCOUNTING_SETTINGS,
  type AccountingSettings,
} from "./accountingModuleSettings.js";
import { moduleFieldConfigPutBodyBaseSchema } from "../schemas/moduleFieldConfig.dto.js";
import { deepSanitizeStrings } from "../schemas/sanitize.js";
import { resolveAccountingFieldsMap } from "./accountingSetupFields.js";
import type { AccountingModulePreferences } from "./accountingSetupPreferences.js";

/** PUT /api/accounting/field-config — field registry JSON without prefs keys. */
const accountingFieldConfigPutBodyBaseSchema = moduleFieldConfigPutBodyBaseSchema;

export const accountingFieldConfigPutBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, accountingFieldConfigPutBodyBaseSchema);

/** Extracts field-config slice from a raw composed settings blob. */
export function normalizeAccountingSettings(raw: unknown): AccountingSettings {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_ACCOUNTING_SETTINGS };
  }
  const safe = raw as Partial<AccountingSettings>;
  return {
    currency: DEFAULT_ACCOUNTING_SETTINGS.currency, // managed by preferences
    currencySymbol: DEFAULT_ACCOUNTING_SETTINGS.currencySymbol,
    dateFormat: DEFAULT_ACCOUNTING_SETTINGS.dateFormat,
    decimalSeparator: DEFAULT_ACCOUNTING_SETTINGS.decimalSeparator,
    decimalPlaces: DEFAULT_ACCOUNTING_SETTINGS.decimalPlaces,
    fyStartMonth: DEFAULT_ACCOUNTING_SETTINGS.fyStartMonth,
    accountCodeLength: DEFAULT_ACCOUNTING_SETTINGS.accountCodeLength,
    requireNarration: DEFAULT_ACCOUNTING_SETTINGS.requireNarration,
    allowEditPosted: DEFAULT_ACCOUNTING_SETTINGS.allowEditPosted,
    autoPostDrafts: DEFAULT_ACCOUNTING_SETTINGS.autoPostDrafts,
    retainedEarningsAccount: DEFAULT_ACCOUNTING_SETTINGS.retainedEarningsAccount,
    organizationName: DEFAULT_ACCOUNTING_SETTINGS.organizationName,
    defaultViewLayout: DEFAULT_ACCOUNTING_SETTINGS.defaultViewLayout,
    fields: resolveAccountingFieldsMap(
      safe.fields && typeof safe.fields === "object" && !Array.isArray(safe.fields)
        ? (safe.fields as Record<string, unknown>)
        : undefined,
    ),
    customFields: Array.isArray(safe.customFields) ? safe.customFields : [],
    fieldOrder: Array.isArray(safe.fieldOrder)
      ? safe.fieldOrder
      : DEFAULT_ACCOUNTING_SETTINGS.fieldOrder,
    formTabs: Array.isArray(safe.formTabs) ? safe.formTabs : DEFAULT_ACCOUNTING_SETTINGS.formTabs,
    enabledTabs: Array.isArray(safe.enabledTabs)
      ? safe.enabledTabs
      : DEFAULT_ACCOUNTING_SETTINGS.enabledTabs,
    requiredTabs: Array.isArray(safe.requiredTabs)
      ? safe.requiredTabs
      : DEFAULT_ACCOUNTING_SETTINGS.requiredTabs,
  };
}

/** Recomposes preferences and field-config into the legacy flat settings shape. */
export function composeAccountingSettings(
  fieldConfig: AccountingSettings | null,
  prefs: AccountingModulePreferences,
  formTabs?: TabDefinition[],
): AccountingSettings {
  return {
    ...(fieldConfig ?? DEFAULT_ACCOUNTING_SETTINGS),
    currency: prefs.currency,
    currencySymbol: prefs.currencySymbol,
    dateFormat: prefs.dateFormat,
    decimalSeparator: prefs.decimalSeparator,
    decimalPlaces: prefs.decimalPlaces,
    fyStartMonth: prefs.fyStartMonth,
    accountCodeLength: prefs.accountCodeLength,
    requireNarration: prefs.requireNarration,
    allowEditPosted: prefs.allowEditPosted,
    autoPostDrafts: prefs.autoPostDrafts,
    retainedEarningsAccount: prefs.retainedEarningsAccount,
    organizationName: prefs.organizationName,
    defaultViewLayout: prefs.defaultViewLayout,
    journalTemplates: prefs.journalTemplates ?? [],
    ...(formTabs ? { formTabs } : {}),
  };
}

/** Drops preference keys before saving field-config to avoid overriding prefs layer. */
export function stripAccountingFieldConfigForPersist(
  config: Partial<AccountingSettings>,
): Partial<AccountingSettings> {
  // `name: _name` aliases: the bound locals exist only to omit preference keys from the rest object.
  const {
    currency: _currency,
    currencySymbol: _currencySymbol,
    dateFormat: _dateFormat,
    decimalSeparator: _decimalSeparator,
    decimalPlaces: _decimalPlaces,
    fyStartMonth: _fyStartMonth,
    accountCodeLength: _accountCodeLength,
    requireNarration: _requireNarration,
    allowEditPosted: _allowEditPosted,
    autoPostDrafts: _autoPostDrafts,
    retainedEarningsAccount: _retainedEarningsAccount,
    organizationName: _organizationName,
    defaultViewLayout: _defaultViewLayout,
    journalTemplates: _journalTemplates,
    ...fieldConfigOnly
  } = config;
  return fieldConfigOnly;
}

export function mergeAccountingFormTabsFromApi(
  documentFormTabs: TabDefinition[] | undefined,
  apiTabs: TabDefinition[],
): TabDefinition[] {
  const documentOrDefault = documentFormTabs && documentFormTabs.length > 0 ? documentFormTabs : [];
  const merged = apiTabs.length === 0 ? documentOrDefault : [...apiTabs];
  const seenKeys = new Set<string>();
  return merged.filter((tab) => {
    if (!tab?.key || seenKeys.has(tab.key)) return false;
    seenKeys.add(tab.key);
    return true;
  });
}
