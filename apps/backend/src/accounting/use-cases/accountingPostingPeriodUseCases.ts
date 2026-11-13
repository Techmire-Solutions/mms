import type { PostingPeriod } from "@mms/shared";
import { requireTenant } from "../../lib/tenantContext.js";
import { withTenant, type AppDb } from "../../db/tenant-context.js";
import { accountingRepository } from "../repository/accountingRepositoryAdapter.js";
import { recordModernAuditEvent } from "../../services/auditTrailService.js";
import { lockFiscalYearForPosting } from "../ledgerPosting/fiscalYearPostingLock.js";

/**
 * Monthly posting-period lock operations (close / reopen) — split out of
 * `accountingLedgerOpsUseCases.ts` to keep that module inside the length ceiling.
 */

async function broadcast(tenant: string, collection: string): Promise<void> {
  const { broadcastTenantUpdate } = await import("../../lib/livePush.js");
  broadcastTenantUpdate(tenant, "collection", collection);
}

/** Monthly posting periods of a fiscal year (all when omitted). */
export async function loadPostingPeriods(fiscalYearId?: string): Promise<PostingPeriod[]> {
  return accountingRepository.listPostingPeriods(requireTenant(), fiscalYearId);
}

function periodError(message: string, statusCode: number) {
  return Object.assign(new Error(message), {
    statusCode,
    type: statusCode === 404 ? "not_found" : "validation_error",
  });
}

/**
 * Closes one posting period (the monthly lock).
 *
 * Takes the fiscal year's advisory lock — the same one every posting path holds —
 * so the status flip cannot interleave with an in-flight posting into that year.
 * The database re-checks the lock at commit (0249), so a bypassing writer still
 * cannot land an entry inside a closed period.
 */
export async function closePostingPeriod(
  periodId: string,
  closedBy: string,
  reason?: string,
): Promise<PostingPeriod> {
  const tenant = requireTenant();
  const closed = await withTenant(tenant, async (tx) => {
    const period = await accountingRepository.findPostingPeriodById(tenant, periodId);
    if (!period) throw periodError("Posting period not found", 404);
    if (period.status === "closed") throw periodError("Posting period is already closed", 422);
    await lockFiscalYearForPosting(tenant, [period.fiscalYearId]);
    const result = await accountingRepository.setPostingPeriodStatus(
      tenant,
      periodId,
      "closed",
      closedBy,
    );
    if (!result) throw periodError("Posting period not found", 404);
    await recordModernAuditEvent(tx as unknown as AppDb, {
      workspaceSubdomain: tenant,
      tableName: "accounting_posting_periods",
      recordId: periodId,
      actionType: "UPDATE",
      realUserId: closedBy,
      oldState: { id: period.id, status: period.status, reason: null },
      newState: {
        id: result.id,
        status: result.status,
        closedAt: result.closedAt,
        closedBy: result.closedBy,
        reason: reason ?? null,
      },
    });
    return result;
  });
  await broadcast(tenant, "accounting_posting_periods");
  return closed;
}

/**
 * Reopens a posting period. Refused once its fiscal year is closed: a lock that
 * the year-end close imposed must not be lifted from under the closing entry.
 */
export async function reopenPostingPeriod(
  periodId: string,
  reopenedBy: string,
  reason?: string,
): Promise<PostingPeriod> {
  const tenant = requireTenant();
  const reopened = await withTenant(tenant, async (tx) => {
    const period = await accountingRepository.findPostingPeriodById(tenant, periodId);
    if (!period) throw periodError("Posting period not found", 404);
    const year = await accountingRepository.findFiscalYearById(tenant, period.fiscalYearId);
    if (year?.status === "closed") {
      throw periodError("Cannot reopen a posting period of a closed fiscal year", 422);
    }
    await lockFiscalYearForPosting(tenant, [period.fiscalYearId]);
    const result = await accountingRepository.setPostingPeriodStatus(
      tenant,
      periodId,
      "open",
      reopenedBy,
    );
    if (!result) throw periodError("Posting period not found", 404);
    await recordModernAuditEvent(tx as unknown as AppDb, {
      workspaceSubdomain: tenant,
      tableName: "accounting_posting_periods",
      recordId: periodId,
      actionType: "UPDATE",
      realUserId: reopenedBy,
      oldState: { id: period.id, status: period.status, closedAt: period.closedAt },
      newState: {
        id: result.id,
        status: result.status,
        closedAt: null,
        reopenedBy,
        reason: reason ?? null,
      },
    });
    return result;
  });
  await broadcast(tenant, "accounting_posting_periods");
  return reopened;
}
