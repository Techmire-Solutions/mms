import { escapeHtml } from "@/lib/escapeHtml";
import { autoPrintWindow, PRINT_FONT_LINK, PRINT_FONT_STACK } from "@/lib/printWindowHtml";

export interface PrintHtmlDocumentOptions {
  /** Active UI language, written to `<html lang>` and used for font shaping. */
  language?: string;
  /** Writing direction of the document; RTL certificates must not print LTR. */
  isRtl?: boolean;
  /** CSS size of the printed page (defaults to A4 portrait at 96dpi). */
  pageWidthPx?: number;
  pageHeightPx?: number;
}

/**
 * Opens a print window for an HTML fragment (certificates, report cards) and prints it.
 *
 * `title` can contain user-authored text (student names, receipt numbers), so it is
 * escaped before it reaches the HTML parser. The popup is same-origin (about:blank
 * inherits the opener), and an unescaped `</title><script>` would execute there with
 * access to the readable CSRF cookie.
 */
export function printHtmlDocument(
  title: string,
  content: string,
  options: PrintHtmlDocumentOptions = {},
): void {
  const language = options.language?.trim() || "en";
  const direction = options.isRtl ? "rtl" : "ltr";
  const width = options.pageWidthPx ?? 794; // A4 portrait at 96dpi
  const height = options.pageHeightPx ?? 1123;
  const win = window.open("", "_blank");
  if (!win) return;
  // Same-origin about:blank; sever the opener so print content cannot reach back
  // into the app window even if a future interpolation slips.
  win.opener = null;
  win.document.write(`
    <!DOCTYPE html>
    <html lang="${language}" dir="${direction}">
      <head>
        <title>${escapeHtml(title)}</title>
        <link href="${PRINT_FONT_LINK}" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background: white;
            direction: ${direction};
            font-family: ${PRINT_FONT_STACK};
          }
          @page { size: ${width}px ${height}px portrait; margin: 0; }
          @media print {
            body {
              width: ${width}px;
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `);
  win.document.close();
  autoPrintWindow(win);
}
