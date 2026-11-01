/**
 * @file templateDocumentPrint.ts
 * @description Opens a print window for a rendered document-template page.
 *
 * The print document is built from the template's own page size/orientation so a
 * designed A5 receipt or A4 report card prints at the right paper size, with the
 * window's writing direction following the active locale. All modules share this
 * instead of hand-writing print CSS per feature.
 */

import { getPageDimensions, type DocumentTemplate } from "@mms/shared";

/** Only the paper geometry is needed to build/print a page. */
export type PrintableDocumentTemplate = Pick<DocumentTemplate, "pageSize" | "orientation">;
import { autoPrintWindow, buildPrintWindowHtml } from "@/lib/printWindowHtml";

export interface BuildTemplatePrintHtmlOptions {
  template: PrintableDocumentTemplate;
  /** Title of the print window / document. */
  windowTitle: string;
  /** Active UI language (e.g. `en`, `ar`). */
  language: string;
  isRtl: boolean;
  /** Pre-rendered, unscaled page markup (normally `previewElement.innerHTML`). */
  bodyContent: string;
}

export function buildTemplatePrintHtml({
  template,
  windowTitle,
  language,
  isRtl,
  bodyContent,
}: BuildTemplatePrintHtmlOptions): string {
  const size = getPageDimensions(template.pageSize, template.orientation);
  return buildPrintWindowHtml({
    windowTitle,
    language,
    direction: isRtl ? "rtl" : "ltr",
    width: size.width,
    height: size.height,
    orientation: template.orientation || "portrait",
    bodyContent,
  });
}

export interface PrintTemplateDocumentOptions extends Omit<
  BuildTemplatePrintHtmlOptions,
  "bodyContent"
> {
  /** Element containing the unscaled 1:1 page markup (hidden or on-screen). */
  previewElement: HTMLElement | null;
}

/**
 * Prints the rendered template.
 *
 * @returns `false` when the popup was blocked or nothing was rendered; the caller
 * decides how to surface that (the editor's actions show a toast).
 */
export function printTemplateDocument({
  previewElement,
  template,
  windowTitle,
  language,
  isRtl,
}: PrintTemplateDocumentOptions): boolean {
  if (!previewElement) return false;

  const size = getPageDimensions(template.pageSize, template.orientation);
  const win = window.open("", "_blank", `width=${size.width + 80},height=${size.height + 120}`);
  if (!win) return false;

  win.opener = null;
  win.document.write(
    buildTemplatePrintHtml({
      template,
      windowTitle,
      language,
      isRtl,
      bodyContent: previewElement.innerHTML,
    }),
  );
  win.document.close();
  autoPrintWindow(win);
  return true;
}
