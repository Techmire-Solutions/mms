import { activeDb } from "../../db/dbConnection.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { accountingFxRepository } from "../repository/accountingFxRepositoryAdapter.js";
import type { ExchangeRateUseCaseDeps } from "./exchangeRateUseCases.js";

/** Production wiring: the audit row joins the request's tenant transaction. */
export const exchangeRateDeps: ExchangeRateUseCaseDeps = {
  fx: accountingFxRepository,
  recordAudit: (input) => recordModernAuditEvent(activeDb(), input),
};
