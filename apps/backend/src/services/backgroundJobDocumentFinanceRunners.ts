import { saveStreamedExportArtifact } from "./exportArtifactService.js";
import { registerBackgroundJobRunner } from "./backgroundJobWorkerService.js";

/**
 * Headless document runners.
 *
 * The finance job registrations that used to live here (`finance:collect`,
 * `finance:render-receipt`, `finance:render-ledger`, `finance:export-excel`) had
 * no enqueue path — the routes for those flows call the use cases directly and
 * scheduled automation runs as a leader-only sweep — so they were removed rather
 * than implying a queue pipeline that never runs.
 */
export function registerDocumentAndFinanceJobRunners(): void {
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
}
