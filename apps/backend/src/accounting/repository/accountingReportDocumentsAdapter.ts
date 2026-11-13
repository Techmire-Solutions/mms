import { getCurrencySettings } from "../../db/repositories/accountingCurrencySettingsRepository.js";
import {
  listLedgerExportRows,
  loadLedgerDocument,
} from "../../db/repositories/accountingLedgerDocumentRepository.js";

/**
 * Storage seam for the printable report documents (PDFs and the streamed ledger
 * export). Use cases and services stay free of `db/repositories` imports; the
 * adapter is the one place that names the concrete repositories (ports & adapters).
 */
export type {
  LedgerExportPage,
  LedgerExportRow,
} from "../../db/repositories/accountingLedgerDocumentRepository.js";

export const accountingReportDocumentsRepository = {
  getCurrencySettings,
  loadLedgerDocument,
  listLedgerExportRows,
};
