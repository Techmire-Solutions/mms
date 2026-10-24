import { ACCOUNTING_MODULE_MANIFEST } from "@mms/shared";
import { withTenant } from "../../db/tenant-context.js";
import { activeDb } from "../../db/dbConnection.js";
import { lockJournalEntries } from "../../db/repositories/accountingEntryLocks.js";
import { findActiveReversalOf } from "../../db/repositories/accountingEntryReversalRepository.js";
import {
  findAccountsByIds,
  findEntryById,
  listFiscalYearsByWorkspace,
  saveEntry,
} from "../../db/repositories/accountingRepository.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { broadcastTenantUpdate } from "../../lib/livePush.js";
import type { ReverseJournalEntryDeps } from "./reverseJournalEntryUseCase.js";

/** Production wiring: one tenant transaction carries the lock, the reversal and its audit row. */
export const reverseJournalEntryDeps: ReverseJournalEntryDeps = {
  transaction: (tenant, work) => withTenant(tenant, () => work(), { readOnly: false }),
  lockJournalEntries,
  findEntryById,
  findActiveReversalOf,
  listFiscalYears: (tenant) => listFiscalYearsByWorkspace(tenant),
  findAccountsByIds: (tenant, ids) => findAccountsByIds(tenant, ids),
  saveEntry,
  recordAudit: (input) => recordModernAuditEvent(activeDb(), input),
  broadcast: (tenant) =>
    broadcastTenantUpdate(tenant, "collection", ACCOUNTING_MODULE_MANIFEST.collectionKey),
  now: () => new Date(),
};
