import {
  ACCOUNTING_MODULE_MANIFEST,
  type AccountingLedgerExportBody,
  type AccountingReportPdfBody,
  type BackgroundJobRecord,
} from "@mms/contracts";
import { buildBackgroundJobId, buildDeterministicJobKey } from "../jobs/jobIds.js";
import { getAccountingJobEnqueuer } from "../jobs/enqueuer.js";

import { recordModernAuditEvent } from "@mms/be-core/audit";

/**
 * Enqueues for the printable-statement PDF and the streamed ledger export.
 *
 * Shared by the ts-rest contract handler so the audit row, deterministic job id and
 * idempotent re-submit behave identically for both requests.
 */

export class QueueUnavailableError extends Error {}

/** Queues `accounting:report-pdf`; a repeat submit returns the stored job. */
export async function enqueueAccountingReportPdf(
  tenant: string,
  userId: string,
  body: AccountingReportPdfBody,
): Promise<BackgroundJobRecord> {
  const moduleId = ACCOUNTING_MODULE_MANIFEST.moduleId;
  const kind = "report-pdf";
  const idempotencyKey =
    body.filename ?? buildDeterministicJobKey({ moduleId, kind, payload: body });
  const jobId = buildBackgroundJobId(tenant, userId, idempotencyKey);
  const port = getAccountingJobEnqueuer();
  const existing = await port.getUserJob(userId, jobId);
  if (existing) return existing;

  const job: BackgroundJobRecord = {
    id: jobId,
    moduleId,
    kind,
    status: "running",
    label: `Generating ${body.kind} PDF`,
    createdAt: new Date().toISOString(),
  };
  const queued = await port.enqueueJob(tenant, userId, job, body);
  await recordModernAuditEvent({
    workspaceSubdomain: tenant,
    tableName: "accounting_reports",
    recordId: queued.id,
    actionType: "VIEW",
    realUserId: userId,
    newState: { action: "accounting.report.pdf", kind: body.kind },
  });
  return queued;
}

/** Queues the streamed full-ledger CSV (`accounting:export-ledger`). */
export async function enqueueAccountingLedgerExport(
  tenant: string,
  userId: string,
  viewerRole: string,
  body: AccountingLedgerExportBody,
): Promise<BackgroundJobRecord> {
  const job = await getAccountingJobEnqueuer().enqueueCsvExport({
    tenant,
    userId,
    moduleId: ACCOUNTING_MODULE_MANIFEST.moduleId,
    kind: "export-ledger",
    label: "Exporting general ledger…",
    query: {
      accountId: body.accountId,
      dateFrom: body.dateFrom,
      dateTo: body.dateTo,
    },
    filename: body.filename,
    viewerRole,
    allowDeleted: false,
    idempotencyKey: body.filename,
  });
  await recordModernAuditEvent({
    workspaceSubdomain: tenant,
    tableName: ACCOUNTING_MODULE_MANIFEST.collectionKey,
    recordId: job.id,
    actionType: "VIEW",
    realUserId: userId,
    newState: { action: "accounting.export.queue", kind: "export-ledger" },
  });
  return job;
}
