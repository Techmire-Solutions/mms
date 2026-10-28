import { escapeHtml } from "@/lib/escapeHtml";

/**
 * Opens a print window for an HTML fragment (certificates, report cards) and prints it.
 *
 * `title` can contain user-authored text (student names, receipt numbers), so it is
 * escaped before it reaches the HTML parser. The popup is same-origin (about:blank
 * inherits the opener), and an unescaped `</title><script>` would execute there with
 * access to the readable CSRF cookie.
 */
export function printHtmlDocument(title: string, content: string): void {
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', sans-serif; background: white; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `);
  win.document.close();
  win.focus();
  void win.document.fonts.ready.then(() => {
    win.print();
    win.close();
  });
}
