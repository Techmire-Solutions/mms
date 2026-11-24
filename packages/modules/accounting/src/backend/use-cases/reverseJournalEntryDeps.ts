import { ACCOUNTING_MODULE_MANIFEST } from "@mms/contracts";
import { withTenant } from "@mms/db/context";
import { lockJournalEntries } from "../repository/accountingEntryLocks.js";
import { findActiveReversalOf } from "../repository/accountingEntryReversalRepository.js";
import {
  findEntryById,
  listFiscalYearsByWorkspace,
  lockPostableAccounts,
  saveEntry,
} from "../repository/accountingRepositoryTypes.js";
import { findClosedPostingPeriodForDate } from "../repository/accountingPostingPeriodsRepository.js";
import { recordModernAuditEvent } from "@mms/be-core/audit";
import { broadcastTenantUpdate } from "@mms/be-core/realtime";
import type { ReverseJournalEntryDeps } from "./reverseJournalEntryUseCase.js";

/** Production wiring: one tenant transaction carries the lock, the reversal and its audit row. */
export const reverseJournalEntryDeps: ReverseJournalEntryDeps = {
  transaction: (tenant, work) => withTenant(tenant, () => work(), { readOnly: false }),
  lockJournalEntries,
  findEntryById,
  findActiveReversalOf,
  listFiscalYears: (tenant) => listFiscalYearsByWorkspace(tenant),
  findClosedPostingPeriodForDate,
  lockPostableAccounts,
  saveEntry,
  recordAudit: (input) => recordModernAuditEvent(input),
  broadcast: (tenant) =>
    broadcastTenantUpdate(tenant, "collection", ACCOUNTING_MODULE_MANIFEST.collectionKey),
  now: () => new Date(),
};
