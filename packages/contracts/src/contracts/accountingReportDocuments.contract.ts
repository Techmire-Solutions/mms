import { z } from "zod";
import { accountingErrorEnvelopeSchema } from "../finance/accountingErrorCodes.js";
import {
  accountingLedgerExportBodySchema,
  accountingReportPdfBodySchema,
} from "../finance/accountingReportEndpoints.js";

/**
 * Report-document contract entries (printable PDF + streamed ledger export).
 *
 * Split from `accounting.contract.ts` for the 300-line ceiling; spread into the
 * accounting router so the client paths stay `/api/accounting/reports/...`.
 */

/** Shape of a queued report document job (mirrors `BackgroundJobRecord`). */
export const accountingBackgroundJobSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  kind: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  label: z.string(),
  progress: z.object({ current: z.number(), total: z.number() }).optional(),
  error: z.string().optional(),
  errors: z.array(z.object({ row: z.number(), reason: z.string() })).optional(),
  hasDownload: z.boolean().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});

const errorResponse = accountingErrorEnvelopeSchema;

export const accountingReportDocumentContract = {
  /**
   * Printable statement PDF (Trial Balance / General Ledger). Server-rendered by
   * the Typst engine so Arabic/Urdu/Farsi are shaped and laid out RTL; the client
   * downloads it from the background-jobs tray.
   */
  requestReportPdf: {
    method: "POST" as const,
    path: "/api/accounting/reports/pdf",
    body: accountingReportPdfBodySchema,
    responses: {
      202: z.object({ job: accountingBackgroundJobSchema }),
      400: errorResponse,
      403: errorResponse,
      503: errorResponse,
      500: errorResponse,
    },
    summary: "Queue a BiDi report PDF",
  },
  /** Streamed full-ledger CSV (the grid export only covers the loaded page). */
  exportLedger: {
    method: "POST" as const,
    path: "/api/accounting/reports/ledger/export",
    body: accountingLedgerExportBodySchema,
    responses: {
      202: z.object({ job: accountingBackgroundJobSchema }),
      400: errorResponse,
      403: errorResponse,
      503: errorResponse,
      500: errorResponse,
    },
    summary: "Queue the full general-ledger CSV export",
  },
};
