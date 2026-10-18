import { createReadStream } from "node:fs";
import { compileTypstToFile, type TypstTemplateType } from "./typst-compiler.js";
import {
  uploadStreamToStorage,
  resolveTenantExportKey,
  type StorageUploadResult,
} from "../../config/storage.js";

export interface PdfRenderJobPayload {
  template: TypstTemplateType;
  data: Record<string, unknown>;
  filename: string;
  lang?: "ar" | "ur" | "fa" | "en";
  direction?: "rtl" | "ltr";
}

export async function processPdfRenderJob(
  tenantId: string,
  payload: PdfRenderJobPayload,
  onProgress?: (percent: number) => Promise<void> | void,
): Promise<StorageUploadResult> {
  if (onProgress) await onProgress(20);

  const compiled = await compileTypstToFile({
    template: payload.template,
    data: payload.data,
    lang: payload.lang,
    direction: payload.direction,
  });

  try {
    if (onProgress) await onProgress(60);

    const key = resolveTenantExportKey(
      tenantId,
      payload.filename.endsWith(".pdf") ? payload.filename : `${payload.filename}.pdf`,
    );

    const readStream = createReadStream(compiled.filePath);
    try {
      const result = await uploadStreamToStorage(tenantId, key, readStream, "application/pdf");

      if (onProgress) await onProgress(100);

      return result;
    } catch (uploadErr) {
      readStream.destroy(uploadErr instanceof Error ? uploadErr : new Error(String(uploadErr)));
      throw uploadErr;
    }
  } finally {
    await compiled.cleanup();
  }
}
