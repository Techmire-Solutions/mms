import { escapeHtml } from "@/lib/escapeHtml";

export interface PrintHtmlOptions {
  windowTitle: string;
  language: string;
  width: number;
  height: number;
  orientation?: string;
  /** Writing direction of the document — the active locale decides it. */
  direction?: "ltr" | "rtl";
  bodyContent: string;
}

export const PRINT_FONT_STACK =
  "'Inter', 'Readex Pro', 'Noto Nastaliq Urdu', 'Vazirmatn', 'Amiri', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export const PRINT_FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Amiri:wght@400;700&family=Readex+Pro:wght@400;600;700&family=Noto+Nastaliq+Urdu:wght@400;600&family=Vazirmatn:wght@400;600&display=swap";

export function buildPrintWindowHtml({
  windowTitle,
  language,
  width,
  height,
  orientation = "portrait",
  direction = "ltr",
  bodyContent,
}: PrintHtmlOptions): string {
  return `<!DOCTYPE html>
<html lang="${language || "en"}" dir="${direction}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(windowTitle)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: white; direction: ${direction}; font-family: ${PRINT_FONT_STACK}; }
    @page { size: ${width}px ${height}px ${orientation}; margin: 0; }
    @media print {
      body {
        width: ${width}px;
        print-color-adjust: exact;
        -webkit-print-color-adjust: exact;
      }
    }
  </style>
  <link rel="stylesheet" href="${PRINT_FONT_LINK}" />
</head>
<body>
  ${bodyContent}
  <script>
    function triggerPrint() {
      window.focus();
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function() {
          window.print();
        }).catch(function() {
          window.print();
        });
      } else {
        setTimeout(function() {
          window.print();
        }, 200);
      }
    }

    if (document.readyState === 'complete') {
      triggerPrint();
    } else {
      window.addEventListener('load', triggerPrint);
    }

    window.onafterprint = function() {
      window.close();
    };
  </script>
</body>
</html>`;
}
