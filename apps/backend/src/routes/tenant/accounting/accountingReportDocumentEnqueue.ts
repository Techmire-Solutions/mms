import {
  ACCOUNTING_MODULE_MANIFEST,
  type AccountingLedgerExportBody,
  type AccountingReportPdfBody,
  type BackgroundJobRecord,
} from "@mms/shared";
import { buildBackgroundJobId, buildDeterministicJobKey } from "../../../lib/backgroundJobIds.js";
import { enqueueCsvExportJob } from "../../../lib/csvExportEnqueue.js";
import {
  enqueueBackgroundJob,
  getUserBackgroundJob,
  QueueUnavailableError,
} from "../../../services/backgroundJobWorkerService.js";
import { recordModernAuditEvent } from "../../../services/auditTrailService.js";

/**
 * Enqueues for the printable-statement PDF and the streamed ledger export.
 *
 * Shared by the ts-rest contract handler so the audit row, deterministic job id and
 * idempotent re-submit behave identically for both requests.
 */

export { QueueUnavailableError };

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
  const existing = await getUserBackgroundJob(userId, jobId);
  if (existing) return existing;

  const job: BackgroundJobRecord = {
    id: jobId,
    moduleId,
    kind,
    status: "running",
    label: `Generating ${body.kind} PDF`,
    createdAt: new Date().toISOString(),
  };
  const queued = await enqueueBackgroundJob(tenant, userId, job, body);
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
  const job = await enqueueCsvExportJob({
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
