import { recordModernAuditEvent } from "@mms/be-core/audit";
import { accountingFxRepository } from "../repository/accountingFxRepositoryAdapter.js";
import type { ExchangeRateUseCaseDeps } from "./exchangeRateUseCases.js";

/** Production wiring: the audit row joins the request's tenant transaction. */
export const exchangeRateDeps: ExchangeRateUseCaseDeps = {
  fx: accountingFxRepository,
  recordAudit: (input) => recordModernAuditEvent(input),
};
