import { formatDate } from "@mms/shared";
import { escapeHtml } from "@/lib/escapeHtml";
import { PRINT_NEUTRAL } from "@/lib/ui/printBrandingTokens";

export interface CompletionCertificateInput {
  heading: string;
  statement: string;
  studentName: string;
  courseName: string;
  period: string;
  issuedLabel: string;
  issuedOn: string;
  accent: string;
}

/** Printable completion certificate (one page per student, inline styles for the print window). */
export function completionCertificateHtml(input: CompletionCertificateInput): string {
  const e = escapeHtml;
  return `<section style="page-break-after:always;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:48px">
  <div style="width:100%;max-width:760px;border:6px double ${e(input.accent)};padding:56px;text-align:center;color:${PRINT_NEUTRAL.text}">
    <h1 style="font-size:34px;letter-spacing:2px;color:${e(input.accent)}">${e(input.heading)}</h1>
    <p style="margin-top:28px;font-size:15px;color:${PRINT_NEUTRAL.body}">${e(input.statement)}</p>
    <p style="margin-top:18px;font-size:30px;font-weight:700">${e(input.studentName)}</p>
    <p style="margin-top:18px;font-size:20px;color:${PRINT_NEUTRAL.emphasis}">${e(input.courseName)}</p>
    <p style="margin-top:6px;font-size:13px;color:${PRINT_NEUTRAL.caption}">${e(input.period)}</p>
    <p style="margin-top:40px;font-size:12px;color:${PRINT_NEUTRAL.caption}">${e(input.issuedLabel)} ${e(formatDate(input.issuedOn))}</p>
  </div>
</section>`;
}
