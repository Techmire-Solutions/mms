import { PassThrough } from "node:stream";
import { buildTenantExportFilename, CONTACTS_MODULE_MANIFEST } from "@mms/shared";
import { generateContactsVcfStreamChunks } from "../contacts/use-cases/contactExportUseCases.js";
import { resolveTenantExportKey, uploadStreamToStorage } from "../config/storage.js";
import type { ContactsVcfExportJobPayload } from "../services/backgroundJobPayloads.js";
import { saveStreamedExportArtifact } from "../services/exportArtifactService.js";
import {
  registerBackgroundJobRunner,
  type BackgroundJobRunContext,
} from "../services/backgroundJobWorkerService.js";
import { throwIfBackgroundJobAborted } from "./backgroundJobAbort.js";

const VCF_CONTENT_TYPE = "text/vcard; charset=utf-8";

/** Streams the VCF generator to storage and records the keyed artifact. */
async function streamContactsVcfToStorage(
  ctx: BackgroundJobRunContext,
  exportPayload: ContactsVcfExportJobPayload,
  filename: string,
): Promise<number> {
  const passThrough = new PassThrough();
  const key = resolveTenantExportKey(ctx.tenant, filename);
  const uploadPromise = uploadStreamToStorage(ctx.tenant, key, passThrough, VCF_CONTENT_TYPE, {
    signal: ctx.signal,
  });

  const generator = generateContactsVcfStreamChunks({
    filename,
    viewerRole: exportPayload.viewerRole ?? "",
    onProgress: (processed, total) => ctx.updateProgress(processed, Math.max(total, 1)),
  });

  try {
    let step = await generator.next();
    while (!step.done) {
      throwIfBackgroundJobAborted(ctx.signal);
      if (!passThrough.write(step.value)) {
        // Apply backpressure so the in-memory buffer stays bounded to a few chunks.
        await new Promise<void>((resolve) => passThrough.once("drain", () => resolve()));
      }
      step = await generator.next();
    }
    throwIfBackgroundJobAborted(ctx.signal);
    const meta = step.value;
    passThrough.end();
    const result = await uploadPromise;

    await saveStreamedExportArtifact(ctx.userId, ctx.jobId, {
      key: result.key,
      storageType: result.storageType,
      filename: meta.filename || filename,
      contentType: VCF_CONTENT_TYPE,
    });

    return meta.count;
  } catch (error) {
    // Settle the stream and upload so a generator/abort failure cannot leak handles.
    passThrough.destroy(error instanceof Error ? error : new Error(String(error)));
    await uploadPromise.catch(() => {});
    throw error;
  }
}

/** Register the `${contactsModuleId}:export-vcf` background job runner. */
export function registerContactsVcfExportJobRunner(): void {
  registerBackgroundJobRunner(
    `${CONTACTS_MODULE_MANIFEST.moduleId}:export-vcf`,
    async (payload, ctx) => {
      const exportPayload = payload as ContactsVcfExportJobPayload;
      throwIfBackgroundJobAborted(ctx.signal);
      await ctx.updateProgress(0, 1);
      throwIfBackgroundJobAborted(ctx.signal);

      const targetFilename = buildTenantExportFilename(
        ctx.tenant,
        exportPayload.filename?.trim() || "contacts.vcf",
      );
      const count = await streamContactsVcfToStorage(ctx, exportPayload, targetFilename);

      throwIfBackgroundJobAborted(ctx.signal);
      await ctx.complete({
        label: exportPayload.label ?? `Exported ${count} contacts`,
        progress: { current: count, total: count },
        hasDownload: true,
      });
    },
  );
}
