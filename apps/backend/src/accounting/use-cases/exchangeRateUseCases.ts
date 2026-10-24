import type {
  AccountingCurrencySettings,
  AccountingCurrencySettingsPut,
  ExchangeRateListQuery,
  ExchangeRateLookupQuery,
  ExchangeRateLookupResult,
  ExchangeRatePutItem,
  ExchangeRateRecord,
} from "@mms/shared";
import { ConflictError, NotFoundError } from "../../lib/httpErrors.js";
import type { RecordModernAuditInput } from "../../services/auditTrailService.js";
import type { AccountingFxRepository } from "../repository/accountingFxRepository.js";

export interface ExchangeRateUseCaseDeps {
  fx: AccountingFxRepository;
  /** Writes inside the caller's tenant transaction so the audit row commits with the change. */
  recordAudit: (input: RecordModernAuditInput) => Promise<unknown>;
}

interface Actor {
  tenant: string;
  userId: string | null;
}

export function getCurrencySettings(
  deps: ExchangeRateUseCaseDeps,
  tenant: string,
): Promise<AccountingCurrencySettings> {
  return deps.fx.getCurrencySettings(tenant);
}

/**
 * Save functional/presentation currency and the enabled list. The functional
 * currency is frozen once anything is posted: IAS 21.35 applies a change
 * prospectively, which needs a dedicated restatement procedure, not an edit.
 */
export async function updateCurrencySettings(
  deps: ExchangeRateUseCaseDeps,
  actor: Actor,
  input: AccountingCurrencySettingsPut,
): Promise<AccountingCurrencySettings> {
  const current = await deps.fx.getCurrencySettings(actor.tenant);
  if (current.locked && current.functionalCurrency !== input.functionalCurrency) {
    throw new ConflictError(
      "The functional currency cannot change after journal entries have been posted",
    );
  }
  const saved = await deps.fx.saveCurrencySettings(actor.tenant, input, actor.userId);
  await deps.recordAudit({
    workspaceSubdomain: actor.tenant,
    tableName: "accounting_currency_settings",
    recordId: actor.tenant,
    actionType: "UPDATE",
    realUserId: actor.userId,
    oldState: current,
    newState: saved,
  });
  return saved;
}

export function listExchangeRates(
  deps: ExchangeRateUseCaseDeps,
  tenant: string,
  query: ExchangeRateListQuery,
): Promise<ExchangeRateRecord[]> {
  return deps.fx.listExchangeRates(tenant, query);
}

/** Upsert manual rates; every write is audited with its source and override reason. */
export async function upsertExchangeRates(
  deps: ExchangeRateUseCaseDeps,
  actor: Actor,
  items: readonly ExchangeRatePutItem[],
): Promise<ExchangeRateRecord[]> {
  const saved = await deps.fx.upsertExchangeRates(actor.tenant, items, actor.userId);
  for (const rate of saved) {
    await deps.recordAudit({
      workspaceSubdomain: actor.tenant,
      tableName: "accounting_exchange_rates",
      recordId: rate.id,
      actionType: "UPDATE",
      realUserId: actor.userId,
      newState: rate,
    });
  }
  return saved;
}

/** The rate in force on a date, or 404 — callers must never fall back to 1. */
export async function lookupExchangeRate(
  deps: ExchangeRateUseCaseDeps,
  tenant: string,
  query: ExchangeRateLookupQuery,
): Promise<ExchangeRateLookupResult> {
  const found = await deps.fx.lookupExchangeRate(tenant, query);
  if (!found) {
    throw new NotFoundError(
      `No ${query.rateType} rate for ${query.fromCurrency}→${query.toCurrency} on or before ${query.date}`,
    );
  }
  return found;
}
