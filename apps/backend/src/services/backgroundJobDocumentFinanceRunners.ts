import { saveStreamedExportArtifact } from "./exportArtifactService.js";
import { registerBackgroundJobRunner } from "./backgroundJobWorkerService.js";

/** Cap on ledger entries carried in the `finance:export-excel` job payload. */
export const MAX_EXCEL_PAYLOAD_ENTRIES = 50_000;

export function registerDocumentAndFinanceJobRunners(): void {
  // Phase 6: Headless BiDi Document Engine & Streaming Excel exports
  registerBackgroundJobRunner("students:render-report-card", async (payload, ctx) => {
    const { processPdfRenderJob } = await import("../worker/processors/pdf-rendering.js");
    await ctx.updateProgress(10, 100);
    const data = (payload as { data: Record<string, unknown>; filename?: string }).data || {};
    const filename = (payload as { filename?: string }).filename || "report-card.pdf";
    const result = await processPdfRenderJob(
      ctx.tenant,
      {
        template: "report-card",
        data,
        filename,
      },
      async (pct) => ctx.updateProgress(pct, 100),
      ctx.signal,
    );
    await saveStreamedExportArtifact(ctx.userId, ctx.jobId, {
      key: result.key,
      storageType: result.storageType,
      filename,
      contentType: "application/pdf",
    });
    await ctx.complete({
      label: `Generated Report Card (${result.key})`,
      progress: { current: 100, total: 100 },
      hasDownload: true,
    });
  });

  registerBackgroundJobRunner("finance:render-receipt", async (payload, ctx) => {
    const { processPdfRenderJob } = await import("../worker/processors/pdf-rendering.js");
    await ctx.updateProgress(10, 100);
    const data = (payload as { data: Record<string, unknown>; filename?: string }).data || {};
    const filename = (payload as { filename?: string }).filename || "fee-receipt.pdf";
    const result = await processPdfRenderJob(
      ctx.tenant,
      {
        template: "fee-receipt",
        data,
        filename,
      },
      async (pct) => ctx.updateProgress(pct, 100),
      ctx.signal,
    );
    await saveStreamedExportArtifact(ctx.userId, ctx.jobId, {
      key: result.key,
      storageType: result.storageType,
      filename,
      contentType: "application/pdf",
    });
    await ctx.complete({
      label: `Generated Fee Receipt (${result.key})`,
      progress: { current: 100, total: 100 },
      hasDownload: true,
    });
  });

  registerBackgroundJobRunner("finance:render-ledger", async (payload, ctx) => {
    const { processPdfRenderJob } = await import("../worker/processors/pdf-rendering.js");
    await ctx.updateProgress(10, 100);
    const data = (payload as { data: Record<string, unknown>; filename?: string }).data || {};
    const filename = (payload as { filename?: string }).filename || "financial-ledger.pdf";
    const result = await processPdfRenderJob(
      ctx.tenant,
      {
        template: "financial-ledger",
        data,
        filename,
      },
      async (pct) => ctx.updateProgress(pct, 100),
      ctx.signal,
    );
    await saveStreamedExportArtifact(ctx.userId, ctx.jobId, {
      key: result.key,
      storageType: result.storageType,
      filename,
      contentType: "application/pdf",
    });
    await ctx.complete({
      label: `Generated Financial Ledger (${result.key})`,
      progress: { current: 100, total: 100 },
      hasDownload: true,
    });
  });

  registerBackgroundJobRunner("finance:collect", async (_payload, ctx) => {
    const { collectOverdueInvoices } =
      await import("../finance/use-cases/financeCollectUseCases.js");
    await ctx.updateProgress(0, 1);
    const result = await collectOverdueInvoices({ applyLateFee: true });
    await ctx.complete({
      label: `Marked ${result.markedOverdue} overdue; applied ${result.lateFeesApplied} late fees`,
      progress: { current: 1, total: 1 },
    });
  });

  registerBackgroundJobRunner("finance:export-excel", async (payload, ctx) => {
    const { streamTableToExcel } = await import("../worker/processors/excel-export.js");
    const { filename = "ledger-export.xlsx", entries = [] } = payload as {
      filename?: string;
      entries?: Record<string, unknown>[];
    };

    // Guard against unbounded payloads being carried in the job data / DB row.
    if (entries.length > MAX_EXCEL_PAYLOAD_ENTRIES) {
      throw new Error(
        `Ledger export exceeds maximum of ${MAX_EXCEL_PAYLOAD_ENTRIES} entries carried in the job payload.`,
      );
    }

    async function* generateRows() {
      for (const entry of entries) {
        yield entry;
      }
    }

    await ctx.updateProgress(10, 100);
    const result = await streamTableToExcel({
      tenantId: ctx.tenant,
      filename,
      worksheetName: "Ledger",
      columns: [
        { header: "Date", key: "date", width: 15 },
        { header: "Account", key: "account", width: 25 },
        { header: "Debit", key: "debit", width: 15 },
        { header: "Credit", key: "credit", width: 15 },
        { header: "Balance", key: "balance", width: 15 },
        { header: "Description", key: "description", width: 35 },
      ],
      rowGenerator: generateRows(),
    });
    await saveStreamedExportArtifact(ctx.userId, ctx.jobId, {
      key: result.key,
      storageType: result.storageType,
      filename,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    await ctx.complete({
      label: `Streamed Ledger to Excel (${result.key})`,
      progress: { current: 100, total: 100 },
      hasDownload: true,
    });
  });
}
